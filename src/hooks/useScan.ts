"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAppStore } from "@/store";
import type {
  ScanSliceState,
  ScanStage,
  ScanStreamEvent,
} from "@/lib/scanner/types";

export interface UseScanApi {
  startScan: (url: string, mode?: "single" | "full") => Promise<void>;
  cancelScan: () => void;
}

export interface UseScanOptions {
  // Test seams — production callers should leave these undefined.
  fetchImpl?: typeof fetch;
  now?: () => string;
}

export function useScan(options: UseScanOptions = {}): UseScanApi {
  const setScan = useAppStore((s) => s.setScan);
  const resetScan = useAppStore((s) => s.resetScan);
  const abortRef = useRef<AbortController | null>(null);
  const { fetchImpl = fetch, now = () => new Date().toISOString() } = options;

  const cancelScan = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const startScan = useCallback(
    async (url: string, mode: "single" | "full" = "full") => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      resetScan();
      setScan({
        status: "crawling",
        progress: 0,
        error: null,
        scanId: null,
      });

      try {
        const response = await fetchImpl("/api/scan/full", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, mode }),
          signal: ac.signal,
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          const code = typeof body?.error === "string" ? body.error : `http_${response.status}`;
          setScan({ status: "error", error: code });
          return;
        }
        if (!response.body) {
          setScan({ status: "error", error: "empty_response_body" });
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            const remaining = drainBuffer(buffer + decoder.decode());
            for (const event of remaining.events) applyEventToStore(event, setScan, now);
            break;
          }
          buffer += decoder.decode(value, { stream: true });
          const parsed = drainBuffer(buffer);
          buffer = parsed.remainder;
          for (const event of parsed.events) applyEventToStore(event, setScan, now);
        }
      } catch (err) {
        if (isAbortError(err)) {
          setScan({ status: "idle", error: null });
          return;
        }
        const message = err instanceof Error ? err.message : String(err);
        setScan({ status: "error", error: message });
      } finally {
        if (abortRef.current === ac) abortRef.current = null;
      }
    },
    [fetchImpl, resetScan, setScan, now],
  );

  return { startScan, cancelScan };
}

// ---------- Pure helpers (exported for testing) ----------

export function parseSseChunk(chunk: string): {
  events: ScanStreamEvent[];
  remainder: string;
} {
  return drainBuffer(chunk);
}

export function applyEventToState(
  state: ScanSliceState,
  event: ScanStreamEvent,
  now: () => string = () => new Date().toISOString(),
): ScanSliceState {
  switch (event.type) {
    case "progress": {
      const status = stageToStatus(event.stage);
      return {
        ...state,
        status,
        progress: event.progress,
        pagesScanned: event.pagesScanned ?? state.pagesScanned,
      };
    }
    case "complete": {
      const r = event.result;
      return {
        ...state,
        status: "complete",
        progress: 100,
        scanId: r.scanId,
        pagesScanned: r.pagesScanned,
        discoveredPages: r.discoveredPages,
        matchedComponentIds: r.matchedComponentIds,
        matchedTemplateIds: r.matchedTemplateIds,
        unmatched: r.unmatched,
        warnings: r.warnings,
        error: null,
        scanAppliedAt: now(),
      };
    }
    case "error": {
      return { ...state, status: "error", error: event.message };
    }
  }
}

function drainBuffer(buffer: string): {
  events: ScanStreamEvent[];
  remainder: string;
} {
  const events: ScanStreamEvent[] = [];
  const chunks = buffer.split("\n\n");
  const remainder = chunks.pop() ?? "";
  for (const chunk of chunks) {
    const dataLine = chunk
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.startsWith("data:"));
    if (!dataLine) continue;
    const json = dataLine.slice(5).trimStart();
    if (!json) continue;
    try {
      const parsed = JSON.parse(json) as ScanStreamEvent;
      events.push(parsed);
    } catch {
      // Ignore malformed SSE frames.
    }
  }
  return { events, remainder };
}

function applyEventToStore(
  event: ScanStreamEvent,
  setScan: (partial: Partial<ScanSliceState>) => void,
  now: () => string,
): void {
  switch (event.type) {
    case "progress":
      setScan({
        status: stageToStatus(event.stage),
        progress: event.progress,
        pagesScanned: event.pagesScanned,
      });
      break;
    case "complete":
      setScan({
        status: "complete",
        progress: 100,
        scanId: event.result.scanId,
        pagesScanned: event.result.pagesScanned,
        discoveredPages: event.result.discoveredPages,
        matchedComponentIds: event.result.matchedComponentIds,
        matchedTemplateIds: event.result.matchedTemplateIds,
        unmatched: event.result.unmatched,
        warnings: event.result.warnings,
        error: null,
        scanAppliedAt: now(),
      });
      break;
    case "error":
      setScan({ status: "error", error: event.message });
      break;
  }
}

function stageToStatus(stage: ScanStage): ScanSliceState["status"] {
  switch (stage) {
    case "crawl":
      return "crawling";
    case "analyze":
      return "analyzing";
    case "match":
      return "matching";
    case "done":
      return "complete";
    default:
      return "crawling";
  }
}

function isAbortError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === "AbortError") return true;
  if (err instanceof Error && err.name === "AbortError") return true;
  return false;
}