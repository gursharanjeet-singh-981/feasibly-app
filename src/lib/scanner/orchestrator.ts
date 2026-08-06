import { randomUUID } from "node:crypto";
import { SCAN_DEFAULTS } from "@/lib/constants";
import type { Component, Template } from "@/types";
import { analyzePage } from "./analyzer";
import { crawl, type CrawlOptions } from "./crawler";
import { matchDetections } from "./matcher";
import { resolveAndAssertPublic } from "./urlGuard";
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
  crawlOptions?: CrawlOptions;
  timeoutMs?: number;
  signal?: AbortSignal;
  now?: () => number;
  idFactory?: () => string;
}

export async function* orchestrateScan(
  options: OrchestrateOptions,
): AsyncGenerator<ScanStreamEvent, void, void> {
  const {
    url,
    library,
    crawlOptions,
    timeoutMs = SCAN_DEFAULTS.timeoutMs,
    signal: externalSignal,
    now = Date.now,
    idFactory = randomUUID,
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

    let crawlResult: Awaited<ReturnType<typeof crawl>>;
    try {
      crawlResult = await crawl(url, {
        ...crawlOptions,
        signal: controller.signal,
        onPage: () => {
          // per-page progress emitted below after crawl completes
        },
      });
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

    const result: ScanResult = {
      scanId,
      liveUrl: url,
      scanDate: new Date(startedAt).toISOString(),
      scanDuration: now() - startedAt,
      pagesScanned: crawlResult.pages.length,
      discoveredPages: discovered,
      matchedComponentIds: match.matchedComponentIds,
      matchedTemplateIds: match.matchedTemplateIds,
      unmatched: match.unmatched,
      warnings,
    };

    yield progress("done", 100, "Scan complete.");
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
  const message = err instanceof Error ? err.message : String(err);
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
