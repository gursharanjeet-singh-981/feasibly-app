import { randomUUID } from "node:crypto";
import pLimit from "p-limit";
import { SCAN_DEFAULTS } from "@/lib/constants";
import type { Component, Template } from "@/types";
import { analyzePage } from "@/lib/scanner/analyzer";
import { crawl, type CrawlOptions, type FetchedPage } from "@/lib/scanner/crawler";
import { matchDetections } from "@/lib/scanner/matcher";
import { detectMarketPathPrefix } from "./scope";
import { UrlGuardError, resolveAndAssertPublic } from "@/lib/scanner/urlGuard";
import type {
  PageAnalysis,
  ScanCompleteEvent,
  ScanErrorEvent,
  ScanProgressEvent,
  ScanResult,
  ScanStage,
  ScanStreamEvent,
} from "@/lib/scanner/types";
import { AI_SCAN_CONFIG } from "./config";
import { cleanHtmlForModel } from "./cleanHtml";
import { clusterPages, fingerprintOf, pickSamples, type PageCluster } from "./cluster";
import { hasAiBudget, reserveDailyAiCall } from "./budget";
import { configuredProviders } from "./provider";
import { mergeAiResults, type AiSampleResult } from "./merge";
import {
  AiProviderError,
  createAiClassifier,
  type AiClassifier,
} from "./provider";

export interface AiScanOptions {
  url: string;
  mode: "single" | "full";
  library: { components: Component[]; templates: Template[] };
  /** Injected in tests. Defaults to the Gemini → Groq classifier built from env keys. */
  classifier?: AiClassifier;
  /** Injected in tests to stub network access. */
  crawlOptions?: CrawlOptions;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  signal?: AbortSignal;
  now?: () => number;
  idFactory?: () => string;
}

interface SampleTask {
  cluster: PageCluster;
  sourceUrl: string;
}

export async function* orchestrateAiScan(
  options: AiScanOptions,
): AsyncGenerator<ScanStreamEvent, void, void> {
  const {
    url,
    mode,
    library,
    crawlOptions,
    timeoutMs = AI_SCAN_CONFIG.timeoutMs,
    signal: externalSignal,
    now = Date.now,
    idFactory = randomUUID,
  } = options;

  const scanId = idFactory();
  const startedAt = now();
  const warnings: string[] = [];

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => {
    const reason = `scan_timeout_after_${timeoutMs}ms`;
    warnings.push(reason);
    controller.abort(new Error(reason));
  }, timeoutMs);
  const onExternalAbort = () => controller.abort(new Error("scan_cancelled"));
  externalSignal?.addEventListener("abort", onExternalAbort, { once: true });

  try {
    // ---------- 0. SSRF re-check ----------
    try {
      await resolveAndAssertPublic(url);
    } catch (err) {
      yield errorEvent(err);
      return;
    }

    // ---------- 0b. AI provider ----------
    let classifier: AiClassifier;
    try {
      classifier =
        options.classifier ??
        createAiClassifier({
          allowedGroups: [...new Set(library.components.map((c) => c.group))],
          allowedTemplates: [...new Set(library.templates.map((t) => t.name))],
          fetchImpl: options.fetchImpl,
        });
    } catch (err) {
      yield errorEvent(err);
      return;
    }

    // ---------- 1. Crawl ----------
    yield progress("crawl", 5, "Fetching pages…");

    const marketPrefix = mode === "full" ? detectMarketPathPrefix(url) : undefined;
    const crawlStart =
      mode === "full" ? new URL(marketPrefix ?? "/", url).toString() : url;

    let crawlResult: Awaited<ReturnType<typeof crawl>>;
    try {
      crawlResult = await crawl(crawlStart, {
        // Whole site: follow links, no per-template pruning, so similar pages are all
        // crawled and heuristics run on each. AI cost is controlled by clustering.
        ...(mode === "single"
          ? { maxPages: 1, maxDepth: 0 }
          : {
              maxPages: AI_SCAN_CONFIG.wholeSiteMaxPages,
              maxDepth: SCAN_DEFAULTS.maxDepth,
              followLinks: true,
              maxPagesPerPathTemplate: 0,
              useSitemapRepresentatives: false,
              ...(marketPrefix ? { scopePathPrefix: marketPrefix } : {}),
            }),
        ...crawlOptions,
        signal: controller.signal,
      });
    } catch (err) {
      yield errorEvent(err);
      return;
    }

    if (controller.signal.aborted) {
      yield errorEvent(controller.signal.reason);
      return;
    }

    if (crawlResult.pages.length === 0) {
      const empty = buildResult({
        scanId,
        url,
        startedAt,
        now,
        warnings: [...warnings, ...crawlResult.warnings, "no_pages_fetched"],
        crawl: crawlResult,
        analyses: [],
        matchedComponentIds: {},
        matchedTemplateIds: {},
        unmatched: [],
        representativeUrls: [],
      });
      yield { type: "complete", result: empty } satisfies ScanCompleteEvent;
      return;
    }
    warnings.push(...crawlResult.warnings);

    const blocked = crawlResult.pages.filter((p) => p.status === 401 || p.status === 403);
    if (blocked.length === crawlResult.pages.length) {
      yield { type: "error", message: "auth_required" } satisfies ScanErrorEvent;
      return;
    }
    if (blocked.length > 0) warnings.push(`auth_wall_partial:${blocked.length}`);
    const analyzable: FetchedPage[] = crawlResult.pages.filter(
      (p) => p.status !== 401 && p.status !== 403,
    );

    yield progress("crawl", 35, `Crawled ${crawlResult.pages.length} page(s).`, crawlResult.pages.length);

    // ---------- 2. Heuristic analysis on every crawled page ----------
    yield progress("analyze", 40, "Running heuristic detection on all pages…", crawlResult.pages.length);
    const heuristicAnalyses: PageAnalysis[] = analyzable.map((p) =>
      analyzePage({ url: p.url, html: p.html, pageType: p.pageType }),
    );

    // ---------- 3. Cluster similar pages and pick AI samples ----------
    const clusters = clusterPages(
      heuristicAnalyses.map(fingerprintOf),
      AI_SCAN_CONFIG.clusterSimilarity,
    ).map((members, id) => ({
      id,
      members,
      samples: pickSamples(members, AI_SCAN_CONFIG.outlierSampleClusterSize),
    }));

    const tasks: SampleTask[] = [];
    for (const cluster of clusters) {
      for (const sourceUrl of cluster.samples) tasks.push({ cluster, sourceUrl });
    }

    // ---------- 4. AI analysis of samples (within per-scan and daily budgets) ----------
    yield progress("analyze", 50, `AI analysing ${tasks.length} representative page(s)…`, crawlResult.pages.length);

    const pageByUrl = new Map(analyzable.map((p) => [p.url, p]));
    const results: AiSampleResult[] = [];
    const providers = new Map<string, number>();
    const failures: string[] = [];
    let callsUsed = 0;
    let budgetStopped = false;
    let dailyStopped = false;
    const limit = pLimit(2);

    await Promise.all(
      tasks.map((task) =>
        limit(async () => {
          if (controller.signal.aborted) return;
          if (callsUsed >= AI_SCAN_CONFIG.maxAiCallsPerBatch) {
            budgetStopped = true;
            return;
          }
          // An injected classifier (tests) is budgeted against Gemini; production uses configured keys.
          const provider = options.classifier
            ? "gemini"
            : configuredProviders().find((p) => hasAiBudget(p));
          if (!provider || !reserveDailyAiCall(provider)) {
            dailyStopped = true;
            return;
          }
          callsUsed += 1; // reserved before awaiting, so the per-scan cap holds under concurrency

          const page = pageByUrl.get(task.sourceUrl);
          if (!page) return;
          const html = cleanHtmlForModel(page.html, AI_SCAN_CONFIG.maxHtmlChars);
          try {
            const { detections, template, provider } = await classifier.classify({ url: page.url, html });
            providers.set(provider, (providers.get(provider) ?? 0) + 1);
            results.push({
              sourceUrl: task.sourceUrl,
              memberUrls: task.cluster.members.map((m) => m.url).filter((u) => u !== task.sourceUrl),
              detections,
              template,
            });
          } catch (err) {
            const code = err instanceof AiProviderError ? err.code : "ai_unknown_error";
            failures.push(`ai_failed:${task.sourceUrl}:${code}`);
          }
        }),
      ),
    );

    yield progress("analyze", 75, `AI analysis complete (${callsUsed} call(s)).`, crawlResult.pages.length);

    const coveredPages = results.reduce((n, r) => n + 1 + r.memberUrls.length, 0);
    const unsampledClusters = clusters.filter((c) => !c.samples.some((s) => results.some((r) => r.sourceUrl === s))).length;

    warnings.push(...failures);
    if (budgetStopped) warnings.push(`ai_budget_exhausted:per_scan_cap=${AI_SCAN_CONFIG.maxAiCallsPerBatch}`);
    if (dailyStopped) warnings.push(`ai_budget_exhausted:daily_cap=${AI_SCAN_CONFIG.dailyAiCallCaps.gemini}`);
    if (unsampledClusters > 0) warnings.push(`ai_clusters_without_result:${unsampledClusters}`);
    warnings.push(
      `ai_scan:mode=${mode};clusters=${clusters.length};ai_calls=${callsUsed};pages_ai_covered=${coveredPages};providers=${[...providers].map(([k, v]) => `${k}:${v}`).join(",") || "none"}`,
    );

    const merged = mergeAiResults(heuristicAnalyses, results, AI_SCAN_CONFIG.propagatedConfidenceFactor);

    // ---------- 5. Match (unchanged matcher) ----------
    yield progress("match", 90, "Matching detections to component library…");
    const match = matchDetections(merged, library);

    const result = buildResult({
      scanId,
      url,
      startedAt,
      now,
      warnings,
      crawl: crawlResult,
      analyses: merged,
      matchedComponentIds: match.matchedComponentIds,
      matchedTemplateIds: match.matchedTemplateIds,
      unmatched: match.unmatched,
      representativeUrls: results.map((r) => r.sourceUrl),
    });
    yield { type: "complete", result } satisfies ScanCompleteEvent;
  } finally {
    clearTimeout(timeoutHandle);
    externalSignal?.removeEventListener("abort", onExternalAbort);
  }
}

// ---------- internals ----------

function progress(stage: ScanStage, pct: number, message: string, pagesScanned?: number): ScanProgressEvent {
  return {
    type: "progress",
    stage,
    progress: Math.max(0, Math.min(100, pct)),
    message,
    pagesScanned,
  };
}

function errorEvent(err: unknown): ScanErrorEvent {
  if (err instanceof UrlGuardError) return { type: "error", message: err.code };
  if (err instanceof AiProviderError) return { type: "error", message: err.code };
  const message = err instanceof Error ? err.message : String(err);
  const normalized = message.toLowerCase();
  if (normalized.includes("timed out") || normalized.includes("timeout")) return { type: "error", message: "scan_timeout" };
  if (normalized.includes("abort") || normalized.includes("cancelled")) return { type: "error", message: "scan_aborted" };
  if (normalized.includes("fetch failed") || normalized.includes("network")) return { type: "error", message: "network_error" };
  return { type: "error", message };
}

function buildResult(args: {
  scanId: string;
  url: string;
  startedAt: number;
  now: () => number;
  warnings: string[];
  crawl: Awaited<ReturnType<typeof crawl>>;
  analyses: PageAnalysis[];
  matchedComponentIds: ScanResult["matchedComponentIds"];
  matchedTemplateIds: ScanResult["matchedTemplateIds"];
  unmatched: ScanResult["unmatched"];
  representativeUrls: string[];
}): ScanResult {
  const { crawl: c } = args;
  return {
    scanId: args.scanId,
    liveUrl: args.url,
    scanDate: new Date(args.startedAt).toISOString(),
    scanDuration: args.now() - args.startedAt,
    pagesScanned: c.pages.length,
    sitemapUrls: c.sitemapUrls,
    representativeUrls: args.representativeUrls,
    scrapedUrls: c.pages.map((p) => p.url),
    unscannedPages: c.unscannedPages,
    discoveredPages: c.pages.map((p) => ({
      url: p.url,
      title: p.title,
      pageType: p.pageType,
      depth: p.depth,
      status: p.status,
    })),
    matchedComponentIds: args.matchedComponentIds,
    matchedTemplateIds: args.matchedTemplateIds,
    unmatched: args.unmatched,
    warnings: args.warnings,
  };
}
