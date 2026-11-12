// Whole-site AI scan, driven by the browser tab. The job state lives in this tab's memory and the
// server is stateless: each request crawls a small chunk of pages or makes one AI call. Closing or
// refreshing the tab ends the job, which is the intended behaviour.
import type {
  AiJobStatus,
  AiJobSummary,
  DiscoveredPage,
  PageAnalysis,
  ScanResult,
  UnscannedPage,
} from "@/lib/scanner/types";
import { matchDetections } from "@/lib/scanner/matcher";
import type { Component, Template } from "@/types";
import { AI_SCAN_CONFIG, type AiProviderName } from "./config";
import { clusterPages, fingerprintOf, pickSamples } from "./cluster";
import { mergeAiResults, type AiSampleResult } from "./merge";
import type { ClassifyResponse, CrawlResponse, CrawledPageSummary, DiscoverResponse, ProviderLimitSummary } from "./apiTypes";

/** Error from an API call. `status` 429 means the provider's quota is used up. */
export class AiApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
  }
}

export interface AiEngineApi {
  discover(url: string, signal?: AbortSignal): Promise<DiscoverResponse>;
  crawl(url: string, urls: string[], signal?: AbortSignal): Promise<CrawlResponse>;
  classify(url: string, page: string, provider: AiProviderName, signal?: AbortSignal): Promise<ClassifyResponse>;
}

/** Per-tab daily call counter. The server cannot share one across users, so each tab keeps its own. */
export class TabAiBudget {
  private used: Record<AiProviderName, number> = { gemini: 0, groq: 0 };
  private caps: Record<AiProviderName, number> = AI_SCAN_CONFIG.dailyAiCallCaps;
  /** Use the caps the server reported for its keys and tiers. */
  setCaps(caps: Record<AiProviderName, number>): void {
    this.caps = caps;
  }
  has(provider: AiProviderName): boolean {
    return this.used[provider] < this.caps[provider];
  }
  reserve(provider: AiProviderName): boolean {
    if (!this.has(provider)) return false;
    this.used[provider] += 1;
    return true;
  }
}

export interface AiEngineDeps {
  api: AiEngineApi;
  library: { components: Component[]; templates: Template[] };
  budget: TabAiBudget;
  /** Waits until the provider's pacing allows another call. */
  waitTurn(provider: AiProviderName): Promise<void>;
  /** Pause used before retrying after the app's own rate limit. Tests pass a no-op. */
  sleep?(ms: number): Promise<void>;
  /** Called once the server reports its limits, so pacing and budget match the key's tier. */
  onLimits?(limits: ProviderLimitSummary): void;
  now(): number;
  onUpdate(job: AiJobSummary, result: ScanResult | null): void;
}

type Terminal = "complete" | "finished" | "stopped" | "error";
type AiOutcome =
  | { kind: "ok"; response: ClassifyResponse; attempts: number }
  | { kind: "failed"; attempts: number }
  | { kind: "no_budget"; reason: "quota" | "no_budget" };

export class BrowserAiJob {
  readonly id: string = newId();
  private status: AiJobStatus = "running";
  private providers: AiProviderName[] = [];
  private provider: AiProviderName | null = null;
  private queue: string[] = [];
  private totalBatches = 0;
  private batchesDone = 0;
  private discovered: DiscoveredPage[] = [];
  private unscanned: UnscannedPage[] = [];
  private analyses: PageAnalysis[] = [];
  private samples: string[] = [];
  private warnings = new Set<string>();
  private providerCounts: Record<AiProviderName, number> = { gemini: 0, groq: 0 };
  private exhausted = new Set<AiProviderName>();
  private pauseRequested = false;
  private finishRequested = false;
  private stopRequested = false;
  private resumeWaiter: ((action: "continue" | "finish" | "stop") => void) | null = null;
  private aiCalls = 0;
  private coveredPages = 0;
  private clustersTotal = 0;
  private clustersWithoutResult = 0;
  private remainingAtEnd: number | null = null;
  /** Pages of the batch being processed. Returned to the queue if the job ends mid-batch. */
  private inFlight: string[] | null = null;
  /** What the current batch is doing, shown in the progress message. */
  private note = "";
  /** Progress through the current batch, 0–100. */
  private batchProgress = 0;
  private error: string | null = null;
  private resultCache: ScanResult | null = null;
  private controller = new AbortController();
  private startedAt = 0;
  private finished: Promise<void> = Promise.resolve();

  constructor(
    readonly url: string,
    private readonly deps: AiEngineDeps,
  ) {}

  /** Lists the pages and plans the batches. Call before start(). */
  async prepare(): Promise<void> {
    this.startedAt = this.deps.now();
    const found = await this.deps.api.discover(this.url, this.controller.signal);
    this.providers = found.providers;
    this.deps.onLimits?.(found.limits);
    for (const w of found.warnings) this.warnings.add(w);
    if (found.urls.length <= 1) {
      throw new AiApiError("sitemap_not_found", 422);
    }
    const cap = AI_SCAN_CONFIG.wholeSiteMaxPages;
    this.queue = found.urls.slice(0, cap);
    for (const url of found.urls.slice(cap)) {
      this.unscanned.push({ url, source: "sitemap", reason: "max_pages_limit" });
    }
    this.totalBatches = Math.max(1, Math.ceil(this.queue.length / AI_SCAN_CONFIG.batchSize));
  }

  start(): Promise<void> {
    this.finished = this.run();
    return this.finished;
  }

  get done(): Promise<void> {
    return this.finished;
  }

  isActive(): boolean {
    return this.status === "running" || this.status === "paused";
  }

  snapshot(): AiJobSummary {
    const status: AiJobStatus = this.status === "running" && this.pauseRequested ? "pausing" : this.status;
    return {
      id: this.id,
      url: this.url,
      status,
      provider: this.provider,
      pagesDiscovered: this.discovered.length + this.pendingCount() + this.unscanned.filter((p) => p.reason === "max_pages_limit").length,
      pagesDone: this.discovered.length,
      pagesRemaining: this.remainingAtEnd ?? this.pendingCount(),
      batchProgress: this.batchProgress,
      progress: this.overallProgress(status),
      batchesDone: this.batchesDone,
      totalBatches: this.totalBatches,
      error: this.error,
      message: this.message(status),
    };
  }

  result(): ScanResult | null {
    return this.resultCache;
  }

  /** Pause after the current batch. */
  pause(): void {
    if (this.status !== "running") return;
    this.pauseRequested = true;
    // Show the pausing state at once, not when the batch ends.
    this.emit();
  }

  /** Continue a paused job. */
  resume(): void {
    if (this.status === "paused" && this.resumeWaiter) {
      const w = this.resumeWaiter;
      this.resumeWaiter = null;
      w("continue");
    }
  }

  /** End after the current batch (immediately if paused). Remaining pages are reported as not scanned. */
  finish(): void {
    if (this.status === "paused" && this.resumeWaiter) {
      const w = this.resumeWaiter;
      this.resumeWaiter = null;
      w("finish");
      return;
    }
    if (this.status === "running") {
      this.finishRequested = true;
      this.pauseRequested = true;
    }
  }

  /** Stop now: aborts the request in flight and discards the batch in progress. */
  stop(): void {
    if (!this.isActive()) return;
    this.stopRequested = true;
    this.controller.abort();
    if (this.status === "paused" && this.resumeWaiter) {
      const w = this.resumeWaiter;
      this.resumeWaiter = null;
      w("stop");
    }
  }

  /** Pages not yet committed: the queue plus the batch in progress. */
  private pendingCount(): number {
    return this.queue.length + (this.inFlight?.length ?? 0);
  }

  /** One number for the whole job, so the bar and the banner always agree. */
  private overallProgress(status: AiJobStatus): number {
    if (status === "complete") return 100;
    const total = Math.max(1, this.totalBatches);
    const value = ((this.batchesDone + this.batchProgress / 100) / total) * 100;
    return Math.min(100, Math.max(0, Math.round(value)));
  }

  private message(status: AiJobStatus): string {
    const batch = `${this.batchesDone} of ${this.totalBatches} batch${this.totalBatches === 1 ? "" : "es"}`;
    const remaining = this.remainingAtEnd ?? this.pendingCount();
    const left = `${remaining} page${remaining === 1 ? "" : "s"}`;
    switch (status) {
      case "running":
        return `Scanning batch ${this.batchesDone + 1} of ${this.totalBatches}${this.note ? `: ${this.note}` : "…"}`;
      case "pausing":
        return `Pausing after the current batch (${batch} done).`;
      case "paused":
        return `Paused after ${batch}. ${left} remain.`;
      case "complete":
        return `Scan complete: ${this.discovered.length} page${this.discovered.length === 1 ? "" : "s"} scanned.`;
      case "finished":
        return `Scan ended by user after ${batch}. ${left} not scanned.`;
      case "stopped":
        return `Scan stopped (page refreshed or closed) after ${batch}. ${left} not scanned.`;
      case "error":
        return `Scan stopped after ${batch}: ${this.error ?? "unknown error"}.`;
    }
  }

  private emit(): void {
    this.deps.onUpdate(this.snapshot(), this.resultCache);
  }

  private async run(): Promise<void> {
    let terminal: Terminal = "complete";
    this.emit();
    try {
      while (true) {
        if (this.stopRequested) {
          terminal = "stopped";
          break;
        }
        if (this.queue.length === 0) break;

        if (this.pauseRequested) {
          this.status = "paused";
          this.emit();
          const action = this.finishRequested ? "finish" : await this.waitForResume();
          if (action === "stop") {
            terminal = "stopped";
            break;
          }
          if (action === "finish") {
            terminal = "finished";
            break;
          }
          this.pauseRequested = false;
        }
        if (this.stopRequested) {
          terminal = "stopped";
          break;
        }

        this.status = "running";
        const batch = this.queue.splice(0, AI_SCAN_CONFIG.batchSize);
        this.inFlight = batch;
        const committed = await this.runBatch(batch);
        this.inFlight = null;
        if (!committed) {
          this.queue.unshift(...batch);
          terminal = "stopped";
          break;
        }
        this.batchesDone += 1;
        this.emit();
        if (this.error) break;
      }
      if (this.error && terminal !== "stopped") terminal = "error";
      if (terminal === "complete" && this.queue.length > 0) terminal = "finished";
    } catch (err) {
      if (this.inFlight) this.queue.unshift(...this.inFlight);
      this.inFlight = null;
      if (this.stopRequested || isAbort(err)) {
        terminal = "stopped";
      } else {
        this.error = err instanceof Error ? err.message : String(err);
        terminal = "error";
      }
    }

    if (terminal === "finished" || terminal === "stopped") {
      this.remainingAtEnd = this.queue.length;
      for (const url of this.queue.splice(0)) {
        this.unscanned.push({ url, source: "sitemap", reason: "job_ended" });
      }
      if (this.resultCache) this.publish();
    }
    this.status = terminal;
    if (terminal === "error" && this.error === null) this.error = "unknown error";
    this.emit();
  }

  private waitForResume(): Promise<"continue" | "finish" | "stop"> {
    return new Promise((resolve) => {
      this.resumeWaiter = resolve;
    });
  }

  /** Crawls one batch in chunks, runs AI on its samples, and commits it. Returns false if stopped. */
  private async runBatch(batch: string[]): Promise<boolean> {
    const pages: CrawledPageSummary[] = [];
    const batchUnscanned: UnscannedPage[] = [];
    this.batchProgress = 0;
    for (let i = 0; i < batch.length; i += AI_SCAN_CONFIG.crawlChunkSize) {
      if (this.stopRequested) return false;
      const chunk = batch.slice(i, i + AI_SCAN_CONFIG.crawlChunkSize);
      this.note = `reading pages ${i + 1}–${i + chunk.length} of ${batch.length}`;
      // Reading is the first 60% of the batch.
      this.batchProgress = Math.round(60 * (i / batch.length));
      this.emit();
      const res = await this.crawlChunk(chunk);
      if (this.stopRequested) return false;
      pages.push(...res.pages);
      batchUnscanned.push(...res.unscannedPages);
      for (const w of res.warnings) this.warnings.add(w);
    }

    const analyzable = pages.filter((p) => p.status !== 401 && p.status !== 403);
    const batchAnalyses: PageAnalysis[] = analyzable.map((p) => ({
      url: p.url,
      pageType: p.pageType,
      detectedComponents: p.detectedComponents,
      detectedTemplate: p.detectedTemplate,
    }));

    const clusters = clusterPages(batchAnalyses.map(fingerprintOf), AI_SCAN_CONFIG.clusterSimilarity).map((members) => ({
      members,
      samples: pickSamples(members, AI_SCAN_CONFIG.outlierSampleClusterSize),
    }));

    const results: AiSampleResult[] = [];
    const sampleTotal = clusters.reduce((n, c) => n + c.samples.length, 0);
    let sampleNo = 0;
    let batchCalls = 0;
    const coveredInBatch = new Set<string>();
    let batchWithoutResult = 0;
    let stopAi: "none" | "batch_cap" | "no_budget" | "quota" = "none";

    outer: for (const cluster of clusters) {
      let clusterHasResult = false;
      for (const sourceUrl of cluster.samples) {
        if (this.stopRequested) break outer;
        if (batchCalls >= AI_SCAN_CONFIG.maxAiCallsPerBatch) {
          stopAi = "batch_cap";
          break outer;
        }
        sampleNo += 1;
        this.note = `AI reviewing sample ${sampleNo} of ${sampleTotal}`;
        // AI review is the last 40%.
        this.batchProgress = 60 + Math.round(40 * (sampleNo / Math.max(1, sampleTotal)));
        this.emit();
        const outcome = await this.callAi(sourceUrl);
        if (outcome.kind === "no_budget") {
          stopAi = outcome.reason === "quota" ? "quota" : "no_budget";
          break outer;
        }
        batchCalls += outcome.attempts;
        if (outcome.kind === "failed") continue;

        clusterHasResult = true;
        results.push({
          sourceUrl,
          memberUrls: cluster.members.map((m) => m.url).filter((u) => u !== sourceUrl),
          detections: outcome.response.detections,
          template: outcome.response.template,
        });
        for (const m of cluster.members) coveredInBatch.add(m.url);
      }
      if (!clusterHasResult) batchWithoutResult += 1;
    }

    if (this.stopRequested) return false;

    // Commit the batch in one go.
    this.unscanned.push(...batchUnscanned);
    for (const p of pages) {
      this.discovered.push({ url: p.url, title: p.title, pageType: p.pageType, depth: p.depth, status: p.status });
    }
    this.note = "";
    // The batch is counted in batchesDone; its progress starts again at 0 for the next batch.
    this.batchProgress = 0;
    this.clustersTotal += clusters.length;
    this.coveredPages += coveredInBatch.size;
    this.clustersWithoutResult += batchWithoutResult;
    this.aiCalls += batchCalls;
    if (stopAi === "batch_cap") this.warnings.add(`ai_budget_exhausted:per_scan_cap=${AI_SCAN_CONFIG.maxAiCallsPerBatch}`);
    if (stopAi === "no_budget") this.warnings.add(`ai_budget_exhausted:daily_cap=${AI_SCAN_CONFIG.dailyAiCallCaps.gemini}`);
    if (stopAi === "quota") this.error = "ai_quota_exhausted";

    const merged = mergeAiResults(batchAnalyses, results, AI_SCAN_CONFIG.propagatedConfidenceFactor);
    this.analyses = [...this.analyses, ...merged];
    this.samples = [...this.samples, ...results.map((r) => r.sourceUrl)];
    this.publish();
    return true;
  }

  private async crawlChunk(urls: string[]): Promise<CrawlResponse> {
    try {
      return await this.deps.api.crawl(this.url, urls, this.controller.signal);
    } catch (err) {
      if (this.stopRequested || isAbort(err)) throw err;
      // One retry for transient failures (timeouts, network blips) before giving up on the job.
      return this.deps.api.crawl(this.url, urls, this.controller.signal);
    }
  }

  /** One AI call for one sample page. On a quota error, moves to the other provider. */
  private async callAi(page: string): Promise<AiOutcome> {
    let attempts = 0;
    let rateRetries = 0;
    let transientRetries = 0;
    while (true) {
      const provider = this.pickProvider();
      if (!provider) {
        const allQuota = this.providers.length > 0 && this.providers.every((p) => this.exhausted.has(p));
        return { kind: "no_budget", reason: allQuota ? "quota" : "no_budget" };
      }
      if (provider !== this.provider) {
        if (this.provider) this.warnings.add(`ai_provider_switched:${this.provider}->${provider}`);
        this.provider = provider;
      }
      this.deps.budget.reserve(provider);
      attempts += 1;
      await this.deps.waitTurn(provider);
      if (this.stopRequested) return { kind: "failed", attempts };
      try {
        const response = await this.deps.api.classify(this.url, page, provider, this.controller.signal);
        this.providerCounts[provider] += 1;
        return { kind: "ok", response, attempts };
      } catch (err) {
        if (this.stopRequested || isAbort(err)) return { kind: "failed", attempts };
        // The app's own request limit: wait, then retry the same provider. This is not a provider quota.
        if (err instanceof AiApiError && err.code === "rate_limited") {
          if (rateRetries < MAX_RATE_RETRIES) {
            rateRetries += 1;
            await (this.deps.sleep ?? defaultSleep)(RATE_RETRY_MS);
            if (this.stopRequested) return { kind: "failed", attempts };
            continue;
          }
          this.warnings.add(`ai_failed:${page}:rate_limited`);
          return { kind: "failed", attempts };
        }
        // The provider's quota, or this server's daily cap, is used up: move to the other provider.
        if (err instanceof AiApiError && err.status === 429) {
          this.exhausted.add(provider);
          this.warnings.add(`ai_quota_reached:${provider}`);
          continue;
        }
        const code = err instanceof AiApiError ? err.code : "ai_unknown_error";
        // Provider outage or overload (e.g. Gemini 503), or an empty reply: not this page's fault.
        // Try the other provider first; with none left, wait and retry the same one.
        if (isTransientProviderCode(code) && transientRetries < MAX_TRANSIENT_RETRIES) {
          transientRetries += 1;
          const other = this.providers.find(
            (p) => p !== provider && !this.exhausted.has(p) && this.deps.budget.has(p),
          );
          if (other) {
            this.warnings.add(`ai_provider_switched:${provider}->${other}`);
            this.provider = other;
          } else {
            await (this.deps.sleep ?? defaultSleep)(TRANSIENT_RETRY_MS);
            if (this.stopRequested) return { kind: "failed", attempts };
          }
          continue;
        }
        this.warnings.add(`ai_failed:${page}:${code}`);
        return { kind: "failed", attempts };
      }
    }
  }

  private pickProvider(): AiProviderName | null {
    const candidates = this.providers.filter((p) => !this.exhausted.has(p) && this.deps.budget.has(p));
    if (this.provider && candidates.includes(this.provider)) return this.provider;
    return candidates[0] ?? null;
  }

  /** Builds the cumulative result from every committed batch. */
  private publish(): void {
    const match = matchDetections(this.analyses, this.deps.library);
    const providers =
      (["gemini", "groq"] as const)
        .filter((p) => this.providerCounts[p] > 0)
        .map((p) => `${p}:${this.providerCounts[p]}`)
        .join(",") || "none";
    const warnings = [
      ...this.warnings,
      `ai_scan:mode=full;batches=${this.batchesDone};clusters=${this.clustersTotal};ai_calls=${this.aiCalls};pages_ai_covered=${this.coveredPages};providers=${providers}`,
    ];
    if (this.clustersWithoutResult > 0) warnings.push(`ai_clusters_without_result:${this.clustersWithoutResult}`);

    this.resultCache = {
      scanId: this.id,
      liveUrl: this.url,
      scanDate: new Date(this.startedAt).toISOString(),
      scanDuration: this.deps.now() - this.startedAt,
      pagesScanned: this.discovered.length,
      sitemapUrls: [],
      representativeUrls: [...new Set(this.samples)],
      scrapedUrls: this.discovered.map((p) => p.url),
      unscannedPages: [...this.unscanned],
      discoveredPages: [...this.discovered],
      matchedComponentIds: match.matchedComponentIds,
      matchedTemplateIds: match.matchedTemplateIds,
      unmatched: match.unmatched,
      warnings,
    };
  }
}

const MAX_RATE_RETRIES = 2;
const RATE_RETRY_MS = 60_000;
const MAX_TRANSIENT_RETRIES = 3;
const TRANSIENT_RETRY_MS = 5_000;

/** Provider 5xx (overload, outage) or an empty reply. The page itself is fine. */
export function isTransientProviderCode(code: string): boolean {
  return /_http_5\d\d$/.test(code) || code.endsWith("_empty_response");
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAbort(err: unknown): boolean {
  return err instanceof DOMException ? err.name === "AbortError" : err instanceof Error && err.name === "AbortError";
}

function newId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `job-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
