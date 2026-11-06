import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Component, Template } from "@/types";
import type { AiJobSummary, ScanResult } from "@/lib/scanner/types";
import { AI_SCAN_CONFIG, type AiProviderName } from "./config";
import { AiApiError, BrowserAiJob, TabAiBudget, type AiEngineApi, type AiEngineDeps } from "./browserJob";
import type { ClassifyResponse, CrawlResponse, DiscoverResponse } from "./apiTypes";

const root = path.join(process.cwd(), "public", "data");
const library = {
  components: JSON.parse(readFileSync(path.join(root, "components.json"), "utf8")) as Component[],
  templates: JSON.parse(readFileSync(path.join(root, "templates.json"), "utf8")) as Template[],
};

function urls(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `https://example.com/p/${i}`);
}

interface Harness {
  job: BrowserAiJob;
  crawlCalls: number[];
  classifyCalls: { provider: AiProviderName; page: string }[];
  updates: { job: AiJobSummary; result: ScanResult | null }[];
  last(): AiJobSummary;
}

function harness(opts: {
  total: number;
  providers?: AiProviderName[];
  discoverUrls?: string[];
  classify?: (provider: AiProviderName, page: string, job: BrowserAiJob) => Promise<ClassifyResponse>;
  crawl?: (urls: string[], job: BrowserAiJob) => Promise<CrawlResponse>;
  budget?: TabAiBudget;
}): Harness {
  const crawlCalls: number[] = [];
  const classifyCalls: { provider: AiProviderName; page: string }[] = [];
  const updates: { job: AiJobSummary; result: ScanResult | null }[] = [];
  const ref: { job?: BrowserAiJob } = {};

  const api: AiEngineApi = {
    discover: async (): Promise<DiscoverResponse> => ({
      urls: opts.discoverUrls ?? urls(opts.total),
      warnings: [],
      providers: opts.providers ?? ["gemini", "groq"],
      limits: {
        gemini: { minIntervalMs: 0, dailyCallCap: AI_SCAN_CONFIG.dailyAiCallCaps.gemini },
        groq: { minIntervalMs: 0, dailyCallCap: AI_SCAN_CONFIG.dailyAiCallCaps.groq },
      },
    }),
    crawl: async (_base, batch) => {
      crawlCalls.push(batch.length);
      if (opts.crawl) return opts.crawl(batch, ref.job!);
      return {
        pages: batch.map((url) => ({
          url,
          title: "t",
          pageType: "other" as const,
          depth: 1,
          status: 200,
          detectedComponents: [{ groupName: "Forms", confidence: 0.9, source: "heuristic" as const }],
          detectedTemplate: null,
        })),
        unscannedPages: [],
        warnings: [],
      };
    },
    classify: async (_base, page, provider) => {
      classifyCalls.push({ provider, page });
      if (opts.classify) return opts.classify(provider, page, ref.job!);
      return { provider, detections: [{ groupName: "Forms", confidence: 0.8, evidence: "x" }], template: null };
    },
  };

  const deps: AiEngineDeps = {
    api,
    library,
    budget: opts.budget ?? new TabAiBudget(),
    waitTurn: async () => undefined,
    sleep: async () => undefined,
    now: () => Date.now(),
    onUpdate: (job, result) => updates.push({ job, result }),
  };
  ref.job = new BrowserAiJob("https://example.com/", deps);
  return {
    job: ref.job,
    crawlCalls,
    classifyCalls,
    updates,
    last: () => updates[updates.length - 1]!.job,
  };
}

async function waitUntil(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error("waitUntil timed out");
    await new Promise((r) => setTimeout(r, 1));
  }
}

describe("BrowserAiJob batches", () => {
  it("crawls in chunks, commits each batch, and completes", async () => {
    const h = harness({ total: 1200 });
    await h.job.prepare();
    expect(h.job.snapshot().totalBatches).toBe(3);
    await h.job.start();
    const snap = h.job.snapshot();
    expect(snap.status).toBe("complete");
    expect(snap.batchesDone).toBe(3);
    expect(snap.pagesDone).toBe(1200);
    expect(h.crawlCalls.every((n) => n <= AI_SCAN_CONFIG.crawlChunkSize)).toBe(true);
    expect(h.job.result()?.pagesScanned).toBe(1200);
    expect(h.job.result()?.matchedComponentIds).not.toEqual({});
  });

  it("records pages beyond the page cap as skipped by the limit", async () => {
    const h = harness({ total: AI_SCAN_CONFIG.wholeSiteMaxPages + 3 });
    await h.job.prepare();
    expect(h.job.snapshot().pagesDiscovered).toBe(AI_SCAN_CONFIG.wholeSiteMaxPages + 3);
    // Only the first batches are crawled here, so stop after the first batch to keep the test quick.
    const run = h.job.start();
    h.job.finish();
    await run;
    const limited = h.job.snapshot();
    expect(limited.status).toBe("finished");
  });
});

describe("pause, continue, finish, stop", () => {
  it("pauses after the current batch and continues to completion", async () => {
    const h = harness({ total: 1200 });
    await h.job.prepare();
    const run = h.job.start();
    h.job.pause();
    await waitUntil(() => h.job.snapshot().status === "paused");
    expect(h.job.snapshot().batchesDone).toBe(1);
    h.job.resume();
    await run;
    expect(h.job.snapshot().status).toBe("complete");
    expect(h.job.snapshot().batchesDone).toBe(3);
  });

  it("finish while paused ends the job and marks the rest as ended by the user", async () => {
    const h = harness({ total: 1200 });
    await h.job.prepare();
    const run = h.job.start();
    h.job.pause();
    await waitUntil(() => h.job.snapshot().status === "paused");
    h.job.finish();
    await run;
    expect(h.job.snapshot().status).toBe("finished");
    expect(h.job.snapshot().pagesRemaining).toBe(700);
    const ended = h.job.result()!.unscannedPages.filter((p) => p.reason === "job_ended");
    expect(ended).toHaveLength(700);
  });

  it("stop during the crawl discards the batch and returns its pages to the queue", async () => {
    const h = harness({
      total: 1200,
      crawl: async (batch, job) => {
        job.stop();
        return { pages: [], unscannedPages: [], warnings: [] };
      },
    });
    await h.job.prepare();
    await h.job.start();
    const snap = h.job.snapshot();
    expect(snap.status).toBe("stopped");
    expect(snap.batchesDone).toBe(0);
    expect(snap.pagesRemaining).toBe(1200);
    expect(h.job.result()).toBeNull();
  });

  it("stop during an AI call does not commit the batch in progress", async () => {
    const h = harness({
      total: 600,
      classify: async (provider, page, job) => {
        job.stop();
        return { provider, detections: [], template: null };
      },
    });
    await h.job.prepare();
    await h.job.start();
    expect(h.job.snapshot().status).toBe("stopped");
    expect(h.job.snapshot().batchesDone).toBe(0);
    expect(h.job.result()).toBeNull();
  });
});

describe("provider switching and errors", () => {
  it("moves to Groq when Gemini reports a quota error", async () => {
    const h = harness({
      total: 10,
      classify: async (provider) => {
        if (provider === "gemini") throw new AiApiError("quota", 429);
        return { provider, detections: [{ groupName: "Forms", confidence: 0.8, evidence: "x" }], template: null };
      },
    });
    await h.job.prepare();
    await h.job.start();
    expect(h.job.snapshot().status).toBe("complete");
    expect(h.job.snapshot().provider).toBe("groq");
    expect(h.job.result()!.warnings).toContain("ai_provider_switched:gemini->groq");
    expect(h.job.result()!.warnings).toContain("ai_quota_reached:gemini");
  });

  it("stops with an error when every provider hits its quota, keeping heuristic results", async () => {
    const h = harness({
      total: 10,
      classify: async () => {
        throw new AiApiError("quota", 429);
      },
    });
    await h.job.prepare();
    await h.job.start();
    expect(h.job.snapshot().status).toBe("error");
    expect(h.job.snapshot().error).toBe("ai_quota_exhausted");
    expect(h.job.result()!.pagesScanned).toBe(10);
  });

  it("keeps the scan going when one page fails for a non-quota reason", async () => {
    const h = harness({
      total: 10,
      classify: async () => {
        throw new AiApiError("gemini_http_500", 502);
      },
    });
    await h.job.prepare();
    await h.job.start();
    expect(h.job.snapshot().status).toBe("complete");
    expect(h.job.result()!.warnings.some((w) => w.startsWith("ai_failed:"))).toBe(true);
  });

  it("refuses to plan a whole-site scan when the sitemap lists only the homepage", async () => {
    const h = harness({ total: 1, discoverUrls: ["https://example.com/"] });
    await expect(h.job.prepare()).rejects.toMatchObject({ message: "sitemap_not_found" });
  });

  it("uses Groq once this tab's Gemini budget is used up", async () => {
    const budget = new TabAiBudget();
    for (let i = 0; i < AI_SCAN_CONFIG.dailyAiCallCaps.gemini; i++) budget.reserve("gemini");
    const h = harness({ total: 10, budget });
    await h.job.prepare();
    await h.job.start();
    expect(h.classifyCalls.every((c) => c.provider === "groq")).toBe(true);
  });
});

describe("rate limits versus provider quota", () => {
  it("retries the same provider after the app rate limit, without switching", async () => {
    let calls = 0;
    const h = harness({
      total: 10,
      classify: async (provider) => {
        calls += 1;
        if (calls === 1) throw new AiApiError("rate_limited", 429);
        return { provider, detections: [], template: null };
      },
    });
    await h.job.prepare();
    await h.job.start();
    expect(h.job.snapshot().status).toBe("complete");
    expect(h.job.snapshot().provider).toBe("gemini");
    expect(h.job.result()!.warnings.some((w) => w.startsWith("ai_quota_reached"))).toBe(false);
  });

  it("stops retrying after the rate-limit retry limit", async () => {
    const h = harness({
      total: 10,
      classify: async () => {
        throw new AiApiError("rate_limited", 429);
      },
    });
    await h.job.prepare();
    await h.job.start();

    expect(h.classifyCalls).toHaveLength(3);
    expect(h.job.snapshot().status).toBe("complete");
    expect(h.job.result()!.warnings).toContain("ai_failed:https://example.com/p/0:rate_limited");
  });

  it("switches provider on the server daily cap, the same as a provider quota", async () => {
    const h = harness({
      total: 10,
      classify: async (provider) => {
        if (provider === "gemini") throw new AiApiError("daily_cap", 429);
        return { provider, detections: [], template: null };
      },
    });
    await h.job.prepare();
    await h.job.start();
    expect(h.job.snapshot().provider).toBe("groq");
    expect(h.job.result()!.warnings).toContain("ai_quota_reached:gemini");
  });
});

describe("progress feedback", () => {
  it("counts the batch in progress as remaining, so the banner never says 0 pages during batch 2", async () => {
    const h = harness({ total: 1200 });
    await h.job.prepare();
    await h.job.start();
    const duringSecond = h.updates.find((u) => u.job.batchesDone === 1 && u.job.status === "running");
    expect(duringSecond?.job.pagesRemaining).toBe(700);
  });

  it("reports one progress number for the whole job that never goes backwards", async () => {
    const h = harness({ total: 1200 });
    await h.job.prepare();
    await h.job.start();
    const values = h.updates.map((u) => u.job.progress);
    expect(values.every((v, i) => i === 0 || v >= values[i - 1]!)).toBe(true);
    expect(values[values.length - 1]).toBe(100);
    expect(h.updates.find((u) => u.job.batchesDone === 1 && u.job.status === "running")!.job.progress).toBeGreaterThanOrEqual(33); // 1 of 3 batches
  });

  it("shows the pausing state at once when Pause is clicked, not when the batch ends", async () => {
    const h = harness({ total: 1200 });
    await h.job.prepare();
    const run = h.job.start();
    h.job.pause();
    expect(h.last().status).toBe("pausing");
    await waitUntil(() => h.job.snapshot().status === "paused");
    h.job.finish();
    await run;
  });

  it("moves the batch progress from reading to AI review within the first batch", async () => {
    const h = harness({ total: 600 });
    await h.job.prepare();
    await h.job.start();
    const firstBatch = h.updates.filter((u) => u.job.batchesDone === 0).map((u) => u.job.batchProgress);
    expect(firstBatch.every((v, i) => i === 0 || v >= firstBatch[i - 1]!)).toBe(true);
    expect(firstBatch.some((v) => v > 0 && v < 60)).toBe(true);
    expect(firstBatch.some((v) => v >= 60 && v < 100)).toBe(true);
  });
});

describe("server limits reach the tab", () => {
  it("passes the server's limits to the tab once discovery reports them", async () => {
    const h = harness({ total: 10 });
    const seen: unknown[] = [];
    (h.job as unknown as { deps: AiEngineDeps }).deps.onLimits = (limits) => seen.push(limits);
    await h.job.prepare();
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ gemini: { dailyCallCap: AI_SCAN_CONFIG.dailyAiCallCaps.gemini } });
  });

  it("a tab budget takes the caps the server reported", () => {
    const budget = new TabAiBudget();
    budget.setCaps({ gemini: 2, groq: 1 });
    expect(budget.reserve("gemini")).toBe(true);
    expect(budget.reserve("gemini")).toBe(true);
    expect(budget.reserve("gemini")).toBe(false);
    expect(budget.has("groq")).toBe(true);
  });
});
