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

export interface ScanSliceState {
  status: ScanStatus;
  progress: number;
  scanId: string | null;
  pagesScanned: number;
  discoveredPages: DiscoveredPage[];
  matchedComponentIds: Record<number, MatchMetadata>;
  matchedTemplateIds: Record<number, MatchMetadata>;
  unmatched: UnmatchedItem[];
  warnings: string[];
  error: string | null;
  scanAppliedAt: string | null;
}

export const initialScanSliceState: ScanSliceState = {
  status: "idle",
  progress: 0,
  scanId: null,
  pagesScanned: 0,
  discoveredPages: [],
  matchedComponentIds: {},
  matchedTemplateIds: {},
  unmatched: [],
  warnings: [],
  error: null,
  scanAppliedAt: null,
};