"use client";

import { useAppStore } from "@/store";
import type { AiJobSummary, ScanResult } from "@/lib/scanner/types";
import { isAiJobActive } from "@/lib/scanner/aiJobState";
import { DATA_URLS } from "@/lib/constants";
import type { Component, Template } from "@/types";
import {
  AiApiError,
  BrowserAiJob,
  TabAiBudget,
  type AiEngineApi,
} from "@/lib/ai-scan/browserJob";
import { AI_SCAN_CONFIG } from "@/lib/ai-scan/config";
import { createThrottle } from "@/lib/ai-scan/throttle";
import type { ClassifyResponse, CrawlResponse, DiscoverResponse } from "@/lib/ai-scan/apiTypes";

// ---------- API calls to the stateless AI routes ----------

async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: unknown };
    const code = typeof data.error === "string" ? data.error : `http_${res.status}`;
    throw new AiApiError(code, res.status);
  }
  return (await res.json()) as T;
}

const api: AiEngineApi = {
  discover: (url, signal) => post<DiscoverResponse>("/api/scan/ai/discover", { url }, signal),
  crawl: (url, urls, signal) => post<CrawlResponse>("/api/scan/ai/crawl", { url, urls }, signal),
  classify: (url, page, provider, signal) =>
    post<ClassifyResponse>("/api/scan/ai/classify", { url, page, provider }, signal),
};

// Pacing and daily budget for this tab. Replaced with the server's limits once discovery reports them.
let throttle = createThrottle(AI_SCAN_CONFIG.minCallIntervalMs);

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`failed to load ${path}`);
  return (await res.json()) as T;
}

// ---------- the job running in this tab ----------

let current: BrowserAiJob | null = null;

/** Starts a whole-site AI scan in this tab. Only one runs per tab. */
export async function startAiJob(url: string): Promise<void> {
  if (current?.isActive()) return;

  const [components, templates] = await Promise.all([
    fetchJson<Component[]>(DATA_URLS.components),
    fetchJson<Template[]>(DATA_URLS.templates),
  ]);
  const budget = new TabAiBudget();
  const job = new BrowserAiJob(url, {
    api,
    library: { components, templates },
    budget,
    waitTurn: (provider) => throttle.waitTurn(provider),
    now: Date.now,
    onUpdate: (summary, result) => applyAiJob(summary, result),
    onLimits: (limits) => {
      throttle = createThrottle({ gemini: limits.gemini.minIntervalMs, groq: limits.groq.minIntervalMs });
      budget.setCaps({ gemini: limits.gemini.dailyCallCap, groq: limits.groq.dailyCallCap });
    },
  });
  current = job;

  try {
    await job.prepare();
  } catch (err) {
    const code = err instanceof Error ? err.message : "scan_failed";
    applyAiJob(
      {
        id: job.id,
        url,
        status: "error",
        provider: null,
        pagesDiscovered: 0,
        pagesDone: 0,
        pagesRemaining: 0,
        batchesDone: 0,
        totalBatches: 0,
        error: code,
        batchProgress: 0,
        progress: 0,
        message: messageFor(code),
      },
      null,
    );
    current = null;
    return;
  }
  void job.start();
}

export function pauseAiJob(): void {
  current?.pause();
}

export function resumeAiJob(): void {
  current?.resume();
}

export function finishAiJob(): void {
  current?.finish();
}

/** Stops the job now. Used by New estimate, Cancel, and when the tab is closed. */
export function stopAiJob(): void {
  current?.stop();
}

export function isAiJobRunningInTab(): boolean {
  return current?.isActive() ?? false;
}

function messageFor(code: string): string {
  if (code === "sitemap_not_found") {
    return "No sitemap was found for this site, so a whole-site scan can't list its pages.";
  }
  if (code === "ai_not_configured") return "AI scanning is not configured on the server.";
  if (code === "rate_limited") return "Too many requests. Wait a few minutes and try again.";
  return "The scan could not start.";
}

// ---------- writing the job into the store ----------

/**
 * Writes a job's state into the store. The first batch's result makes the scan "complete",
 * so the report opens while later batches continue in the background.
 */
export function applyAiJob(job: AiJobSummary, result: ScanResult | null): void {
  const { setScan } = useAppStore.getState();
  const active = isAiJobActive(job.status);

  if (result) {
    setScan({
      aiJob: job,
      scanVariant: "ai",
      status: "complete",
      // While later batches run, the bar shows the current batch, not the whole scan.
      progress: active ? job.progress : 100,
      progressMessage: job.message,
      error: null,
      scanId: result.scanId,
      pagesScanned: result.pagesScanned,
      sitemapUrls: result.sitemapUrls,
      representativeUrls: result.representativeUrls,
      scrapedUrls: result.scrapedUrls,
      unscannedPages: result.unscannedPages,
      discoveredPages: result.discoveredPages,
      matchedComponentIds: result.matchedComponentIds,
      matchedTemplateIds: result.matchedTemplateIds,
      unmatched: result.unmatched,
      warnings: result.warnings,
      scanAppliedAt: new Date().toISOString(),
    });
    return;
  }

  if (job.status === "error") {
    setScan({ aiJob: job, scanVariant: "ai", status: "error", error: job.error ?? "scan_failed" });
    return;
  }

  if (job.status === "finished" || job.status === "stopped") {
    // Ended before any batch completed, so there is nothing to report.
    setScan({ aiJob: job, scanVariant: "ai", status: "error", error: "scan_ended_before_first_batch" });
    return;
  }

  setScan({
    aiJob: job,
    scanVariant: "ai",
    status: active ? "analyzing" : "complete",
    progress: job.progress,
    progressMessage: job.message,
  });
}
