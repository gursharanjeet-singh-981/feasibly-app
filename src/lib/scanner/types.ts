export type PageType =
  | "home"
  | "product-list"
  | "product-detail"
  | "article"
  | "landing"
  | "contact"
  | "search"
  | "other";

export interface DiscoveredPage {
  url: string;
  title: string;
  pageType: PageType;
  depth: number;
  discoveredFrom: "sitemap" | "bfs" | "seed";
}

export interface CrawlWarning {
  code:
    | "robots_disallow"
    | "fetch_error"
    | "timeout"
    | "auth_required"
    | "spa_detected"
    | "sitemap_missing"
    | "max_pages_reached"
    | "invalid_html";
  message: string;
  url?: string;
}

export interface CrawlResult {
  baseUrl: string;
  pagesScanned: number;
  discoveredPages: DiscoveredPage[];
  warnings: CrawlWarning[];
  durationMs: number;
  pageHtml: Map<string, string>;
}

export interface CrawlerOptions {
  maxPages?: number;
  maxDepth?: number;
  concurrency?: number;
  pageTimeoutMs?: number;
  totalTimeoutMs?: number;
  userAgent?: string;
  respectRobots?: boolean;
  fetchImpl?: typeof fetch;
  onProgress?: (event: CrawlProgressEvent) => void;
}

export interface CrawlProgressEvent {
  stage: "sitemap" | "crawl";
  pagesScanned: number;
  pagesQueued: number;
  currentUrl?: string;
}

export interface UnmatchedItem {
  label: string;
  confidence: number;
  foundOnPages: string[];
  suggestedGroup?: string;
}

export interface ScanResult {
  scanId: string;
  liveUrl: string;
  scanDate: string;
  scanDuration: number;
  pagesScanned: number;
  discoveredPages: DiscoveredPage[];
  matchedComponentIds: Record<number, { confidence: number; pages: string[] }>;
  matchedTemplateIds: Record<number, { confidence: number; pages: string[] }>;
  unmatched: UnmatchedItem[];
  warnings: string[];
}

export type ScanStatus =
  | "idle"
  | "crawling"
  | "analyzing"
  | "matching"
  | "complete"
  | "error";

export interface ScanState {
  status: ScanStatus;
  progress: number;
  scanId: string | null;
  liveUrl: string | null;
  pagesScanned: number;
  discoveredPages: DiscoveredPage[];
  matchedComponentIds: Record<number, { confidence: number; pages: string[] }>;
  matchedTemplateIds: Record<number, { confidence: number; pages: string[] }>;
  unmatched: UnmatchedItem[];
  warnings: string[];
  scanAppliedAt: string | null;
  error: string | null;
}

export const emptyScanState: ScanState = {
  status: "idle",
  progress: 0,
  scanId: null,
  liveUrl: null,
  pagesScanned: 0,
  discoveredPages: [],
  matchedComponentIds: {},
  matchedTemplateIds: {},
  unmatched: [],
  warnings: [],
  scanAppliedAt: null,
  error: null,
};
