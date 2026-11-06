export type ScanStatus =
  | "idle"
  | "crawling"
  | "analyzing"
  | "matching"
  | "complete"
  | "error";

export type ScanStage = "crawl" | "analyze" | "match" | "done";

export type PageType =
  | "home"
  | "landing"
  | "product"
  | "listing"
  | "article"
  | "contact"
  | "search"
  | "legal"
  | "other";

export interface DiscoveredPage {
  url: string;
  title: string;
  pageType: PageType;
  depth: number;
  status: number;
}

export type UnscannedPageReason =
  | "robots_disallow"
  | "max_pages_limit"
  | "representative_page"
  | "max_depth"
  | "path_template_limit"
  | "scan_incomplete"
  | "fetch_failed"
  | "unsupported_content"
  | "job_ended";

export interface UnscannedPage {
  url: string;
  source: "sitemap" | "link";
  reason: UnscannedPageReason;
  detail?: string;
}

export interface DetectedComponent {
  groupName: string;
  variantHint?: string;
  confidence: number;
  source: "heuristic" | "ai";
  evidence?: string;
}

export interface DetectedTemplate {
  name: string;
  confidence: number;
  source: "heuristic" | "ai";
}

export interface PageAnalysis {
  url: string;
  pageType: PageType;
  detectedComponents: DetectedComponent[];
  detectedTemplate: DetectedTemplate | null;
}

export interface MatchMetadata {
  confidence: number;
  pages: string[];
  group?: string;
  reason?: string;
}

export interface UnmatchedItem {
  label: string;
  kind: "component" | "template";
  pages: string[];
  confidence: number;
}

export interface ScanProgressEvent {
  type: "progress";
  stage: ScanStage;
  progress: number;
  message: string;
  pagesScanned?: number;
}

export interface ScanResult {
  scanId: string;
  liveUrl: string;
  scanDate: string;
  scanDuration: number;
  pagesScanned: number;
  sitemapUrls: string[];
  representativeUrls: string[];
  scrapedUrls: string[];
  unscannedPages: UnscannedPage[];
  discoveredPages: DiscoveredPage[];
  matchedComponentIds: Record<number, MatchMetadata>;
  matchedTemplateIds: Record<number, MatchMetadata>;
  unmatched: UnmatchedItem[];
  warnings: string[];
}

export interface ScanCompleteEvent {
  type: "complete";
  result: ScanResult;
}

export interface ScanErrorEvent {
  type: "error";
  message: string;
}

export type ScanStreamEvent =
  | ScanProgressEvent
  | ScanCompleteEvent
  | ScanErrorEvent;

export type AiJobStatus = "running" | "pausing" | "paused" | "complete" | "finished" | "stopped" | "error";

/** Client-safe summary of a whole-site AI job. The server keeps the full state. */
export interface AiJobSummary {
  id: string;
  url: string;
  status: AiJobStatus;
  provider: "gemini" | "groq" | null;
  pagesDiscovered: number;
  pagesDone: number;
  pagesRemaining: number;
  /** Progress through the current batch, 0–100 (reading pages, then AI review). */
  batchProgress: number;
  /** Progress through the whole job, 0–100. Moves forward only. */
  progress: number;
  batchesDone: number;
  totalBatches: number;
  error: string | null;
  message: string;
}

export interface ScanSliceState {
  status: ScanStatus;
  progress: number;
  scanId: string | null;
  pagesScanned: number;
  sitemapUrls: string[];
  representativeUrls: string[];
  scrapedUrls: string[];
  unscannedPages: UnscannedPage[];
  discoveredPages: DiscoveredPage[];
  matchedComponentIds: Record<number, MatchMetadata>;
  matchedTemplateIds: Record<number, MatchMetadata>;
  unmatched: UnmatchedItem[];
  warnings: string[];
  error: string | null;
  scanAppliedAt: string | null;
  /** Which scan produced the current state. Null when no scan has run. */
  scanVariant: "regular" | "ai" | null;
  /** Latest progress message from the server, shown in the progress dialog. */
  progressMessage: string | null;
  /** Whole-site AI job, when one is running or paused. */
  aiJob: AiJobSummary | null;
}

export const initialScanSliceState: ScanSliceState = {
  aiJob: null,
  scanVariant: null,
  progressMessage: null,
  status: "idle",
  progress: 0,
  scanId: null,
  pagesScanned: 0,
  sitemapUrls: [],
  representativeUrls: [],
  scrapedUrls: [],
  unscannedPages: [],
  discoveredPages: [],
  matchedComponentIds: {},
  matchedTemplateIds: {},
  unmatched: [],
  warnings: [],
  error: null,
  scanAppliedAt: null,
};