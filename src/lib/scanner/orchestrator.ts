import { randomUUID } from "node:crypto";
import pLimit from "p-limit";
import { SCAN_DEFAULTS } from "@/lib/constants";
import type { Component, Template } from "@/types";
import { analyzePage } from "./analyzer";
import { crawl, type CrawlOptions, type CrawlResult, type FetchedPage } from "./crawler";
import { matchDetections } from "./matcher";
import { UrlGuardError, resolveAndAssertPublic } from "./urlGuard";
import type {
  DiscoveredPage,
  PageAnalysis,
  ScanCompleteEvent,
  ScanErrorEvent,
  ScanProgressEvent,
  ScanResult,
  ScanStage,
  ScanStreamEvent,
} from "./types";

export interface OrchestrateOptions {
  url: string;
  library: { components: Component[]; templates: Template[] };
  mode?: "single" | "full";
  crawlOptions?: CrawlOptions;
  timeoutMs?: number;
  signal?: AbortSignal;
  now?: () => number;
  idFactory?: () => string;
  /** Run this many crawlers in parallel, each scoped to a distinct site section. Default 1. */
  parallelCrawlers?: number;
}

export async function* orchestrateScan(
  options: OrchestrateOptions,
): AsyncGenerator<ScanStreamEvent, void, void> {
  const {
    url,
    library,
    mode = "full",
    crawlOptions,
    timeoutMs = SCAN_DEFAULTS.timeoutMs,
    signal: externalSignal,
    now = Date.now,
    idFactory = randomUUID,
    parallelCrawlers = 1,
  } = options;

  const scanId = idFactory();
  const startedAt = now();
  const warnings: string[] = [];

  // Local abort controller layered on top of the caller-provided signal so timeouts
  // and external cancels both propagate to crawler.
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => {
    warnings.push(`scan_timeout_after_${timeoutMs}ms`);
    controller.abort();
  }, timeoutMs);
  const onExternalAbort = () => controller.abort();
  externalSignal?.addEventListener("abort", onExternalAbort, { once: true });

  try {
    // ---------- 0. SSRF re-check (DNS-aware) ----------
    try {
      await resolveAndAssertPublic(url);
    } catch (err) {
      yield errorEvent(err);
      return;
    }

    // ---------- 1. Crawl ----------
    yield progress("crawl", 5, "Fetching robots.txt and sitemap…");

    // In whole-site mode, always crawl from origin root so subpage inputs
    // (e.g. /library) do not constrain discovery to that single path.
    const crawlStartUrl =
      mode === "full" ? new URL("/", url).toString() : url;
    const marketScopePathPrefix = mode === "full" ? detectMarketPathPrefix(url) : undefined;

    let crawlResult: Awaited<ReturnType<typeof crawl>>;
    try {
      if (mode === "full" && parallelCrawlers > 1) {
        crawlResult = await parallelCrawl(crawlStartUrl, parallelCrawlers, {
          ...(marketScopePathPrefix ? { scopePathPrefix: marketScopePathPrefix } : {}),
          ...crawlOptions,
          signal: controller.signal,
        });
      } else {
        crawlResult = await crawl(crawlStartUrl, {
          ...(mode === "single" ? { maxPages: 1, maxDepth: 0 } : {}),
          ...(marketScopePathPrefix ? { scopePathPrefix: marketScopePathPrefix } : {}),
          ...crawlOptions,
          signal: controller.signal,
          onPage: () => {
            // per-page progress emitted below after crawl completes
          },
        });
      }
    } catch (err) {
      yield errorEvent(err);
      return;
    }

    if (crawlResult.pages.length === 0) {
      warnings.push("no_pages_fetched");
      const emptyResult = finalizeEmpty({
        scanId,
        url,
        startedAt,
        now,
        warnings: [...warnings, ...crawlResult.warnings],
      });
      yield { type: "complete", result: emptyResult } satisfies ScanCompleteEvent;
      return;
    }
    warnings.push(...crawlResult.warnings);

    // ---------- 1b. Auth-wall detection ----------
    const blocked = crawlResult.pages.filter(
      (p) => p.status === 401 || p.status === 403,
    );
    if (blocked.length === crawlResult.pages.length) {
      // Every fetched page was auth-blocked — no useful analysis possible.
      yield { type: "error", message: "auth_required" } satisfies ScanErrorEvent;
      return;
    }
    if (blocked.length > 0) {
      warnings.push(`auth_wall_partial:${blocked.length}`);
    }

    yield progress(
      "crawl",
      35,
      `Crawled ${crawlResult.pages.length} page(s).`,
      crawlResult.pages.length,
    );

    // ---------- 2. Heuristic analyze ----------
    yield progress("analyze", 40, "Running heuristic detection…", crawlResult.pages.length);

    const heuristicAnalyses: PageAnalysis[] = crawlResult.pages.map((p) =>
      analyzePage({ url: p.url, html: p.html, pageType: p.pageType }),
    );

    // ---------- 2b. SPA detection (thin/client-rendered pages) ----------
    const spaUrls = new Set<string>();
    for (let i = 0; i < crawlResult.pages.length; i++) {
      if (isThinContent(crawlResult.pages[i]!.html, heuristicAnalyses[i]!)) {
        spaUrls.add(crawlResult.pages[i]!.url);
        warnings.push(`spa_suspected:${crawlResult.pages[i]!.url}`);
      }
    }
    if (spaUrls.size === crawlResult.pages.length) {
      warnings.push("spa_detected");
    }

    yield progress(
      "analyze",
      60,
      "Heuristic detection complete.",
      crawlResult.pages.length,
    );

    // ---------- 3. Match ----------
    yield progress("match", 90, "Matching detections to component library…");
    const match = matchDetections(heuristicAnalyses, library);

    const discovered: DiscoveredPage[] = crawlResult.pages.map((p) => ({
      url: p.url,
      title: p.title,
      pageType: p.pageType,
      depth: p.depth,
      status: p.status,
    }));
    const scrapedUrls = discovered.map((p) => p.url);

    const result: ScanResult = {
      scanId,
      liveUrl: url,
      scanDate: new Date(startedAt).toISOString(),
      scanDuration: now() - startedAt,
      pagesScanned: crawlResult.pages.length,
      sitemapUrls: crawlResult.sitemapUrls,
      scrapedUrls,
      discoveredPages: discovered,
      matchedComponentIds: match.matchedComponentIds,
      matchedTemplateIds: match.matchedTemplateIds,
      unmatched: match.unmatched,
      warnings,
    };

    yield { type: "complete", result } satisfies ScanCompleteEvent;
  } finally {
    clearTimeout(timeoutHandle);
    externalSignal?.removeEventListener("abort", onExternalAbort);
  }
}

// ---------- internals ----------

function progress(
  stage: ScanStage,
  pct: number,
  message: string,
  pagesScanned?: number,
): ScanProgressEvent {
  return {
    type: "progress",
    stage,
    progress: clamp(pct, 0, 100),
    message,
    pagesScanned,
  };
}

function errorEvent(err: unknown): ScanErrorEvent {
  if (err instanceof UrlGuardError) {
    return { type: "error", message: err.code };
  }

  const message = err instanceof Error ? err.message : String(err);
  const normalized = message.toLowerCase();

  if (normalized.includes("abort")) {
    return { type: "error", message: "scan_aborted" };
  }
  if (normalized.includes("timed out") || normalized.includes("timeout")) {
    return { type: "error", message: "scan_timeout" };
  }
  if (normalized.includes("fetch failed") || normalized.includes("network")) {
    return { type: "error", message: "network_error" };
  }

  return { type: "error", message };
}

function finalizeEmpty(args: {
  scanId: string;
  url: string;
  startedAt: number;
  now: () => number;
  warnings: string[];
}): ScanResult {
  return {
    scanId: args.scanId,
    liveUrl: args.url,
    scanDate: new Date(args.startedAt).toISOString(),
    scanDuration: args.now() - args.startedAt,
    pagesScanned: 0,
    sitemapUrls: [],
    scrapedUrls: [],
    discoveredPages: [],
    matchedComponentIds: {},
    matchedTemplateIds: {},
    unmatched: [],
    warnings: args.warnings,
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

// Very rough "SPA shell" heuristic: strip tags, if visible text is tiny and no
// components were detected, the page is almost certainly client-rendered.
function isThinContent(html: string, analysis: PageAnalysis): boolean {
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length < 200 && analysis.detectedComponents.length === 0;
}

function detectMarketPathPrefix(inputUrl: string): string | undefined {
  try {
    const url = new URL(inputUrl);
    const firstSegment = url.pathname.split("/").filter(Boolean)[0];
    if (!firstSegment) return undefined;
    // Treat common locale-like prefixes as market scoping tokens.
    if (/^[a-z]{2}(?:-[a-z]{2})?$/i.test(firstSegment)) {
      return `/${firstSegment.toLowerCase()}`;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Runs `workerCount` crawlers concurrently, each scoped to a distinct top-level
 * path section of the site. Falls back to a single full crawl if the site does
 * not have enough distinct sections to partition.
 */
async function parallelCrawl(
  startUrl: string,
  workerCount: number,
  options: CrawlOptions,
): Promise<CrawlResult> {
  // Phase 1: lightweight discovery to find top-level section paths.
  const discovery = await crawl(startUrl, {
    ...options,
    maxDepth: 1,
    maxPages: 50,
  });

  const sections = getTopLevelSections(
    [...discovery.sitemapUrls, ...discovery.pages.map((p) => p.url)],
    startUrl,
    options.scopePathPrefix,
  );

  // Not enough distinct sections — fall back to single crawler.
  if (sections.length < 2) {
    return crawl(startUrl, options);
  }

  const limit = pLimit(workerCount);
  const pagesPerWorker = Math.ceil((options.maxPages ?? SCAN_DEFAULTS.maxPages) / sections.length);

  const results = await Promise.all(
    sections.map((prefix) =>
      limit(() =>
        crawl(startUrl, {
          ...options,
          scopePathPrefix: prefix,
          maxPages: pagesPerWorker,
        }),
      ),
    ),
  );

  return mergeCrawlResults([discovery, ...results]);
}

/** Extracts distinct first-segment path prefixes (after any market prefix) from a URL list. */
function getTopLevelSections(
  urls: string[],
  baseUrl: string,
  marketPrefix?: string,
): string[] {
  const base = new URL(baseUrl);
  const seen = new Set<string>();
  for (const raw of urls) {
    try {
      if (new URL(raw).origin !== base.origin) continue;
      const pathname = new URL(raw).pathname;
      const stripped = marketPrefix ? pathname.slice(marketPrefix.length) : pathname;
      const segment = stripped.split("/").filter(Boolean)[0];
      if (!segment) continue;
      seen.add(marketPrefix ? `${marketPrefix}/${segment}` : `/${segment}`);
    } catch {
      // ignore malformed
    }
  }
  return [...seen];
}

function mergeCrawlResults(results: CrawlResult[]): CrawlResult {
  const seenUrls = new Set<string>();
  const pages: FetchedPage[] = [];
  const sitemapUrls: string[] = [];
  const warnings: string[] = [];
  let usedSitemap = false;
  let discoveredCount = 0;

  for (const r of results) {
    usedSitemap = usedSitemap || r.usedSitemap;
    discoveredCount += r.discoveredCount;
    for (const w of r.warnings) warnings.push(w);
    for (const u of r.sitemapUrls) {
      if (!seenUrls.has(u)) sitemapUrls.push(u);
    }
    for (const page of r.pages) {
      if (!seenUrls.has(page.url)) {
        seenUrls.add(page.url);
        pages.push(page);
      }
    }
  }

  return { pages, discoveredCount, usedSitemap, sitemapUrls, warnings };
}