import type { Component, Template } from "@/types";
import { crawlSite } from "./crawler";
import { analyzeHtml } from "./analyzer";
import { matchLibrary } from "./matcher";
import { assertPublicUrl } from "./urlGuard";
import type { CrawlerOptions, ScanResult } from "./types";

export interface OrchestratorOptions extends CrawlerOptions {
  components: Component[];
  templates: Template[];
}

export type OrchestratorEvent =
  | {
      type: "progress";
      stage: "guarding" | "crawling" | "analyzing" | "matching";
      progress: number;
      message?: string;
      pagesScanned?: number;
      currentUrl?: string;
    }
  | { type: "result"; result: ScanResult }
  | { type: "error"; message: string };

function generateScanId(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `scan_${Date.now().toString(36)}_${rand}`;
}

export async function* runScan(
  input: string,
  options: OrchestratorOptions,
): AsyncGenerator<OrchestratorEvent> {
  const started = Date.now();
  const scanId = generateScanId();

  yield { type: "progress", stage: "guarding", progress: 2, message: "Validating URL" };
  const guard = await assertPublicUrl(input);
  if (!guard.ok || !guard.url) {
    yield { type: "error", message: guard.reason ?? "URL rejected" };
    return;
  }

  const { components, templates, ...crawlOpts } = options;

  let latestPagesScanned = 0;
  let latestUrl: string | undefined;
  const crawl = await crawlSite(guard.url.toString(), {
    ...crawlOpts,
    onProgress: (evt) => {
      latestPagesScanned = evt.pagesScanned;
      latestUrl = evt.currentUrl;
    },
  });

  yield {
    type: "progress",
    stage: "crawling",
    progress: 50,
    message: `Crawled ${crawl.pagesScanned} pages`,
    pagesScanned: crawl.pagesScanned,
    currentUrl: latestUrl,
  };

  const analyses = [];
  const total = crawl.discoveredPages.length || 1;
  let i = 0;
  for (const page of crawl.discoveredPages) {
    const html = crawl.pageHtml.get(page.url);
    if (!html) continue;
    analyses.push(analyzeHtml(page.url, html));
    i += 1;
    if (i % 5 === 0 || i === total) {
      yield {
        type: "progress",
        stage: "analyzing",
        progress: 50 + Math.round((i / total) * 35),
        message: `Analyzed ${i}/${total} pages`,
        pagesScanned: latestPagesScanned,
      };
    }
  }

  yield {
    type: "progress",
    stage: "matching",
    progress: 90,
    message: "Matching library",
  };
  const match = matchLibrary(analyses, crawl.discoveredPages, components, templates);

  const result: ScanResult = {
    scanId,
    liveUrl: guard.url.toString(),
    scanDate: new Date().toISOString(),
    scanDuration: Date.now() - started,
    pagesScanned: crawl.pagesScanned,
    discoveredPages: crawl.discoveredPages,
    matchedComponentIds: match.matchedComponentIds,
    matchedTemplateIds: match.matchedTemplateIds,
    unmatched: match.unmatched,
    warnings: crawl.warnings.map((w) => `${w.code}: ${w.message}${w.url ? ` (${w.url})` : ""}`),
  };

  yield { type: "result", result };
}
