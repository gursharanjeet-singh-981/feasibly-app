"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store";
import type { ScanStatus } from "@/lib/scanner/types";

interface Props {
  open: boolean;
  onCancel: () => void;
  onDismiss: () => void;
  onProceed: () => void;
}

const STAGE_LABELS: Record<ScanStatus, string> = {
  idle: "Preparing…",
  crawling: "Discovering pages…",
  analyzing: "Analysing content…",
  matching: "Matching components…",
  complete: "Scan complete",
  error: "Scan failed",
};

export function ScanProgressDialog({ open, onCancel, onDismiss, onProceed }: Props) {
  const scan = useAppStore((s) => s.scan);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (scan.status === "complete" || scan.status === "error") onDismiss();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onDismiss, scan.status]);

  if (!open) return null;

  const label = STAGE_LABELS[scan.status] ?? "Working…";
  const pct = Math.max(0, Math.min(100, scan.progress));
  const isDone = scan.status === "complete";
  const isError = scan.status === "error";
  const isRunning = !isDone && !isError;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="scan-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex flex-col gap-4 p-6">
          <div className="flex flex-col gap-1">
            <h2 id="scan-dialog-title" className="text-xl font-semibold text-black">
              {isError ? "We couldn't scan that site" : "Analysing your live site"}
            </h2>
            <p className="text-sm text-black/60">
              {isError
                ? errorMessage(scan.error)
                : "Feasibly is inspecting the site to pre-select components and templates for you."}
            </p>
          </div>

          {!isError && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-black/70">
                <span>{label}</span>
                <span>{pct}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-black/10">
                <div
                  className="h-full bg-cobalt transition-[width] duration-300 ease-out"
                  style={{ width: `${pct}%` }}
                />
              </div>
              {typeof scan.pagesScanned === "number" && scan.pagesScanned > 0 && (
                <p className="text-xs text-black/50">
                  {scan.pagesScanned} page{scan.pagesScanned === 1 ? "" : "s"} scanned
                </p>
              )}
            </div>
          )}

          {isDone && (
            <div className="flex flex-col gap-1 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
              <span className="font-medium">
                Scan complete — {countMatches(scan.matchedComponentIds)} component group{countMatches(scan.matchedComponentIds) === 1 ? "" : "s"} and {countMatches(scan.matchedTemplateIds)} template{countMatches(scan.matchedTemplateIds) === 1 ? "" : "s"} pre-selected.
              </span>
              {scan.warnings.length > 0 && (
                <span className="text-xs text-emerald-700/80">
                  {scan.warnings.length} warning{scan.warnings.length === 1 ? "" : "s"} recorded.
                </span>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            {isRunning && (
              <Button type="button" variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
            )}
            {isError && (
              <Button type="button" variant="ghost" onClick={onDismiss}>
                Close
              </Button>
            )}
            {isDone && (
              <Button type="button" onClick={onProceed}>
                Continue
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function countMatches(record: Record<number, unknown>): number {
  return Object.keys(record).length;
}

function errorMessage(code: string | null): string {
  if (!code) return "The scan couldn't be completed. You can continue setting up your project manually.";
  const map: Record<string, string> = {
    feature_disabled: "The live-site scan feature is not enabled in this build.",
    invalid_url: "That URL doesn't look right. Please double-check and try again.",
    non_http: "Only http(s) URLs can be scanned.",
    private_host: "That address points to a private network — we can only scan public sites.",
    blocked_tld: "That domain isn't publicly reachable.",
    dns_failure: "We couldn't resolve that domain. Check the URL and your network.",
    rate_limited: "Too many scans from this device recently. Please try again later.",
    invalid_body: "The scan request was malformed. Please refresh and try again.",
    invalid_json: "The scan request was malformed. Please refresh and try again.",
    auth_required: "This site requires authentication — we couldn't reach public pages to analyse.",
    ai_not_configured: "AI analysis is not configured. Please check your API key and try again.",
  };
  return map[code] ?? "Something went wrong while scanning. You can continue setting up your project manually.";
}