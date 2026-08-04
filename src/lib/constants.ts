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
export const STORAGE_VERSION = 3;

export const SCAN_FEATURE_ENABLED = true;
export const SCAN_MAX_PAGES = 50;
export const SCAN_MAX_DEPTH = 3;
export const SCAN_CONCURRENCY = 4;
export const SCAN_PAGE_TIMEOUT_MS = 10_000;
export const SCAN_TOTAL_TIMEOUT_MS = 60_000;
export const SCAN_USER_AGENT = "FeasiblyScanBot/0.1 (+https://feasibly.app)";

export const BUFFER_RATIO = 0.2;
export const BUFFER_MULTIPLIER = 1 + BUFFER_RATIO;
export const DAYS_PER_WEEK = 5;
export const BUFFER_LABEL = `Incl. ${Math.round(BUFFER_RATIO * 100)}% buffer time`;

export const DEFAULT_COMPONENT_GROUP = "New Component";
export const DEFAULT_TEMPLATE_GROUP = "New Template";

export const SCROLL_DELAY_MS = 100;
export const TOAST_DURATION_MS = 3000;

export const PLATFORMS = ["AEM"] as const;
export type Platform = (typeof PLATFORMS)[number];
