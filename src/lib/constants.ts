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
export const STORAGE_VERSION = 2;

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
