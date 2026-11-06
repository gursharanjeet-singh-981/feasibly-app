// Request and response shapes shared by the AI scan routes and the browser. Client-safe: no server imports.
import type { PageType, UnscannedPage, DetectedComponent, DetectedTemplate } from "@/lib/scanner/types";

export type AiProviderName = "gemini" | "groq";

/** The limits this server applies per provider, sent to the tab so it paces and budgets to match. */
export type ProviderLimitSummary = Record<AiProviderName, { minIntervalMs: number; dailyCallCap: number }>;

export interface DiscoverResponse {
  /** Limits for this server's keys and tiers. */
  limits: ProviderLimitSummary;
  /** Every in-scope page URL the sitemaps list. The browser applies the page cap. */
  urls: string[];
  warnings: string[];
  providers: AiProviderName[];
}

export interface CrawledPageSummary {
  url: string;
  title: string;
  pageType: PageType;
  depth: number;
  status: number;
  detectedComponents: DetectedComponent[];
  detectedTemplate: DetectedTemplate | null;
}

export interface CrawlResponse {
  pages: CrawledPageSummary[];
  unscannedPages: UnscannedPage[];
  warnings: string[];
}

export interface ClassifyResponse {
  provider: AiProviderName;
  detections: { groupName: string; confidence: number; evidence: string }[];
  template: string | null;
}
