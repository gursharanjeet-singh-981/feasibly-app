export const ROUTES = {
  home: "/",
  onboarding: "/onboarding",
  components: "/components",
  templates: "/templates",
  globalPrinciples: "/global-principles",
} as const;

export type Route = (typeof ROUTES)[keyof typeof ROUTES];

export const DATA_URLS = {
  components: "/data/components.json",
  templates: "/data/templates.json",
  globalPrinciples: "/data/global-principles.json",
} as const;

export const ICON_SPRITE_URL = "/images/icons.svg";

export const STORAGE_KEY = "feasibly-storage";
export const STORAGE_VERSION = 4;

export const SCAN_FEATURE_ENABLED = true;
// When true, shows a "Single page / Whole site" toggle on the onboarding form.
export const SCAN_SINGLE_PAGE_OPTION_ENABLED = true;

export const SCAN_DEFAULTS = {
  maxPages: 50,
  timeoutMs: 300_000,
  rateLimitPerHour: 5,
  crawlerConcurrency: 4,
  perPageTimeoutMs: 10_000,
  maxDepth: 10,
} as const;

export const BUFFER_OPTIONS = [0, 5, 10, 15, 20] as const;
export const DEFAULT_BUFFER_PERCENT = 20;
export const DAYS_PER_WEEK = 5;
export const getBufferLabel = (bufferPercent: number) =>
  `Incl. ${bufferPercent}% buffer time`;

export const DEFAULT_COMPONENT_GROUP = "New Component";
export const DEFAULT_TEMPLATE_GROUP = "New Template";

export const SCROLL_DELAY_MS = 100;
export const TOAST_DURATION_MS = 3000;

export const PLATFORMS = ["AEM"] as const;
export type Platform = (typeof PLATFORMS)[number];
