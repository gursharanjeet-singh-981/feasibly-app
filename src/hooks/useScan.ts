"use client";

import { useCallback, useRef, useState } from "react";
import { useAppStore } from "@/store";
import type { ScanResult } from "@/lib/scanner/types";

type Stage = "guarding" | "crawling" | "analyzing" | "matching";

interface ProgressPayload {
  type: "progress";
  stage: Stage;
  progress: number;
  message?: string;
  pagesScanned?: number;
  currentUrl?: string;
}

interface ResultPayload {
  type: "result";
  result: ScanResult;
}

interface ErrorPayload {
  type: "error";
  message: string;
}

type ScanEvent = ProgressPayload | ResultPayload | ErrorPayload;

const stageToStatus: Record<Stage, "crawling" | "analyzing" | "matching"> = {
  guarding: "crawling",
  crawling: "crawling",
  analyzing: "analyzing",
  matching: "matching",
};

export interface UseScanReturn {
  isRunning: boolean;
  error: string | null;
  start: (url: string) => Promise<ScanResult | null>;
  cancel: () => void;
}

export function useScan(): UseScanReturn {
  const setScan = useAppStore((s) => s.setScan);
  const resetScan = useAppStore((s) => s.resetScan);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const start = useCallback(
    async (url: string): Promise<ScanResult | null> => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setError(null);
      setIsRunning(true);
      resetScan();
      setScan({ status: "crawling", progress: 0, liveUrl: url });

      try {
        const res = await fetch("/api/scan/full", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const text = await res.text().catch(() => "");
          const msg = text || `Scan request failed (${res.status})`;
          setError(msg);
          setScan({ status: "error", error: msg });
          setIsRunning(false);
          return null;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let finalResult: ScanResult | null = null;

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let sep: number;
          while ((sep = buffer.indexOf("\n\n")) !== -1) {
            const frame = buffer.slice(0, sep);
            buffer = buffer.slice(sep + 2);
            const line = frame.split("\n").find((l) => l.startsWith("data:"));
            if (!line) continue;
            const json = line.slice(5).trim();
            if (!json) continue;
            let evt: ScanEvent;
            try {
              evt = JSON.parse(json) as ScanEvent;
            } catch {
              continue;
            }
            if (evt.type === "progress") {
              setScan({
                status: stageToStatus[evt.stage],
                progress: evt.progress,
                pagesScanned: evt.pagesScanned ?? undefined,
              });
            } else if (evt.type === "result") {
              finalResult = evt.result;
              setScan({
                status: "complete",
                progress: 100,
                scanId: evt.result.scanId,
                liveUrl: evt.result.liveUrl,
                pagesScanned: evt.result.pagesScanned,
                discoveredPages: evt.result.discoveredPages,
                matchedComponentIds: evt.result.matchedComponentIds,
                matchedTemplateIds: evt.result.matchedTemplateIds,
                unmatched: evt.result.unmatched,
                warnings: evt.result.warnings,
                scanAppliedAt: new Date().toISOString(),
                error: null,
              });
            } else if (evt.type === "error") {
              setError(evt.message);
              setScan({ status: "error", error: evt.message });
            }
          }
        }

        setIsRunning(false);
        return finalResult;
      } catch (e) {
        const err = e as Error;
        if (err.name === "AbortError") {
          setScan({ status: "idle" });
          setIsRunning(false);
          return null;
        }
        setError(err.message);
        setScan({ status: "error", error: err.message });
        setIsRunning(false);
        return null;
      } finally {
        abortRef.current = null;
      }
    },
    [resetScan, setScan],
  );

  return { isRunning, error, start, cancel };
}
