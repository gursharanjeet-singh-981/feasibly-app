// Tunables for the AI live-site scan. Kept separate from the regular scanner's
// SCAN_DEFAULTS so the existing scanner's behaviour is unaffected.
export type AiProviderName = "gemini" | "groq";

export const AI_SCAN_CONFIG = {
  /** Pages discovered for a whole-site AI job. */
  wholeSiteMaxPages: 10_000,
  /** Pages per batch. Each batch is reviewed before the next one starts. */
  batchSize: 500,
  /** Pages fetched per request. Keeps each request well inside the 60 s serverless limit. */
  crawlChunkSize: 100,
  /** Max AI model calls per batch. */
  maxAiCallsPerBatch: 15,
  /** Daily AI call cap per provider, from the provider limits below. */
  get dailyAiCallCaps(): Record<AiProviderName, number> {
    return limitsOf().dailyCallCap;
  },
  /** Minimum gap between calls per provider, from the provider limits below. */
  get minCallIntervalMs(): Record<AiProviderName, number> {
    return limitsOf().minIntervalMs;
  },
  /** Concurrent crawl requests within one batch. */
  crawlConcurrency: 4,
  /** Timeout per AI provider request. */
  aiRequestTimeoutMs: 25_000,
  /** Page HTML sent to Gemini is trimmed to this many characters. */
  maxHtmlChars: 60_000,
  /** Page HTML sent to Groq is trimmed further, because its tokens-per-minute limit is small. */
  maxHtmlCharsGroq: 20_000,
  /** Confidence multiplier applied when an AI result is propagated to similar pages. */
  propagatedConfidenceFactor: 0.85,
  /** Clusters larger than this also get their least-similar page sampled. */
  outlierSampleClusterSize: 10,
  /** Jaccard similarity needed for two pages to belong to the same cluster. */
  clusterSimilarity: 0.8,
  /** Timeout for one whole-site AI scan request (single-page scans only). */
  timeoutMs: 300_000,
} as const;

export interface ProviderLimits {
  /** Requests per minute allowed on the key's tier. */
  rpm: number;
  /** Requests per day allowed on the key's tier. */
  rpd: number;
  /** Calls this app makes per day, kept under the provider's limit. */
  dailyCallCap: number;
  /** Gap between calls that keeps requests under the per-minute limit. */
  minIntervalMs: number;
}

const DEFAULT_LIMITS = {
  // Free tier defaults. Set the AI_SCAN_*_RPM / _RPD variables to your tier's numbers from AI Studio.
  gemini: { rpm: 15, rpd: 500 },
  // Groq's limit that binds for gpt-oss-20b is tokens per day (200K), so the default is a call count.
  groq: { rpm: 30, rpd: 1000, dailyCalls: 30 },
};

function envNumber(name: string, fallback: number): number {
  const env: Record<string, string | undefined> = typeof process !== "undefined" ? process.env : {};
  const value = Number(env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * Limits for each provider, read from environment variables so they follow the key's tier.
 * The defaults are the free-tier numbers. Google does not publish limits through the API, so
 * they are read from AI Studio (Rate limit page) and set here.
 */
export function providerLimits(): Record<AiProviderName, ProviderLimits> {
  const gRpm = envNumber("AI_SCAN_GEMINI_RPM", DEFAULT_LIMITS.gemini.rpm);
  const gRpd = envNumber("AI_SCAN_GEMINI_RPD", DEFAULT_LIMITS.gemini.rpd);
  const qRpm = envNumber("AI_SCAN_GROQ_RPM", DEFAULT_LIMITS.groq.rpm);
  const qRpd = envNumber("AI_SCAN_GROQ_RPD", DEFAULT_LIMITS.groq.rpd);
  return {
    gemini: {
      rpm: gRpm,
      rpd: gRpd,
      dailyCallCap: envNumber("AI_SCAN_GEMINI_DAILY_CALLS", Math.floor(gRpd * 0.9)),
      minIntervalMs: Math.ceil(60_000 / gRpm) + 100,
    },
    groq: {
      rpm: qRpm,
      rpd: qRpd,
      dailyCallCap: envNumber("AI_SCAN_GROQ_DAILY_CALLS", DEFAULT_LIMITS.groq.dailyCalls),
      minIntervalMs: Math.ceil(60_000 / qRpm) + 100,
    },
  };
}

function limitsOf(): {
  dailyCallCap: Record<AiProviderName, number>;
  minIntervalMs: Record<AiProviderName, number>;
} {
  const l = providerLimits();
  return {
    dailyCallCap: { gemini: l.gemini.dailyCallCap, groq: l.groq.dailyCallCap },
    minIntervalMs: { gemini: l.gemini.minIntervalMs, groq: l.groq.minIntervalMs },
  };
}

export function geminiConfig() {
  return {
    model: process.env.AI_SCAN_GEMINI_MODEL ?? "gemini-3.1-flash-lite",
    apiKey: process.env.GEMINI_API_KEY,
  };
}

export function groqConfig() {
  return {
    model: process.env.AI_SCAN_GROQ_MODEL ?? "openai/gpt-oss-20b",
    apiKey: process.env.GROQ_API_KEY,
  };
}

export function isAiScanEnabled(): boolean {
  return process.env.AI_SCAN_ENABLED === "true";
}
