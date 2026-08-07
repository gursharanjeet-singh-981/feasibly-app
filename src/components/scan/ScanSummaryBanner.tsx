"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store";
import { exportScanReport } from "@/lib/exportScanReport";
import { TOAST_DURATION_MS } from "@/lib/constants";
import type { ScanSliceState } from "@/lib/scanner/types";

type Kind = "components" | "templates";

interface Props {
  kind: Kind;
}

export function ScanSummaryBanner({ kind }: Props) {
  const scan = useAppStore((s) => s.scan);
  const project = useAppStore((s) => s.project);
  const components = useAppStore((s) => s.components);
  const templates = useAppStore((s) => s.templates);
  const [exporting, setExporting] = useState(false);

  if (scan.status !== "complete" || !scan.scanAppliedAt) return null;

  const matchedCount =
    kind === "components"
      ? Object.keys(scan.matchedComponentIds).length
      : Object.keys(scan.matchedTemplateIds).length;

  const unmatched = scan.unmatched.filter((item) =>
    kind === "components" ? item.kind === "component" : item.kind === "template",
  );
  const issues = getScanIssues(scan);

  const label = kind === "components" ? "component group" : "template";
  const plural = matchedCount === 1 ? label : `${label}s`;

  const spaDetected = scan.warnings.includes("spa_detected");
  const authPartial = scan.warnings.some((w) => w.startsWith("auth_wall_partial:"));

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportScanReport(project, scan, components, templates);
    } finally {
      setTimeout(() => setExporting(false), TOAST_DURATION_MS);
    }
  };

  return (
    <div className="mb-3 flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-strokes/60 bg-background-blue px-4 py-3 text-sm text-black">
        <div className="flex flex-col gap-0.5">
          <p className="font-medium">
            {matchedCount} {plural} detected across {scan.pagesScanned} page
            {scan.pagesScanned === 1 ? "" : "s"}.
          </p>
          <p className="text-xs text-black/60">
            Auto-selected items are marked with a confidence indicator. You can adjust the selection at any time.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {kind === "components" && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleExport}
              disabled={exporting}
              className="h-8 gap-1.5 border-cobalt text-cobalt hover:bg-cobalt hover:text-white"
            >
              <Download size={14} />
              {exporting ? "Exporting…" : "Export scan report"}
            </Button>
          )}
          {unmatched.length > 0 && (
            <details className="text-xs">
            <summary className="cursor-pointer text-cobalt hover:underline">
              {unmatched.length} unmatched item{unmatched.length === 1 ? "" : "s"}
            </summary>
            <ul className="mt-2 max-h-40 list-disc overflow-auto pl-4 text-black/70">
              {unmatched.slice(0, 20).map((u, i) => (
                <li key={`${u.label}-${i}`}>
                  <span className="font-mono">{u.label}</span>
                  <span className="text-black/50"> [{u.kind}]</span>
                  {typeof u.confidence === "number" && (
                    <span className="text-black/40"> ({Math.round(u.confidence * 100)}%)</span>
                  )}
                  <span className="text-black/50"> on {u.pages.length} page{u.pages.length === 1 ? "" : "s"}</span>
                  {u.pages.length > 0 && (
                    <div className="mt-0.5 text-[11px] text-black/45">{u.pages.slice(0, 2).join(" | ")}</div>
                  )}
                </li>
              ))}
              {unmatched.length > 20 && (
                <li className="text-black/40">…and {unmatched.length - 20} more</li>
              )}
            </ul>
          </details>
          )}
        </div>
      </div>
      {(spaDetected || authPartial) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
          {spaDetected && (
            <p>
              This looks like a client-rendered app — server HTML was thin, so results are heuristic-only. Review the selections carefully.
            </p>
          )}
          {authPartial && (
            <p>Some pages required authentication and were skipped.</p>
          )}
        </div>
      )}
      {issues.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-900">
          <details>
            <summary className="cursor-pointer font-medium">
              {issues.length} page issue{issues.length === 1 ? "" : "s"} found (login/access/load failures)
            </summary>
            <ul className="mt-2 max-h-48 list-disc overflow-auto pl-4 text-red-900/90">
              {issues.slice(0, 30).map((issue, i) => (
                <li key={`${issue.url}-${issue.reason}-${i}`}>
                  <span className="font-medium">{issue.category}</span>
                  <span className="text-red-900/70">: {issue.reason}</span>
                  <div className="text-[11px] text-red-900/70">{issue.url}</div>
                </li>
              ))}
              {issues.length > 30 && (
                <li className="text-red-900/60">…and {issues.length - 30} more</li>
              )}
            </ul>
          </details>
        </div>
      )}
    </div>
  );
}

interface ScanIssue {
  url: string;
  category: string;
  reason: string;
}

function getScanIssues(scan: ScanSliceState): ScanIssue[] {
  const issues: ScanIssue[] = [];

  for (const page of scan.discoveredPages) {
    if (page.status >= 200 && page.status < 300) continue;
    issues.push({
      url: page.url,
      category: classifyStatusCategory(page.status),
      reason: `${page.status} ${statusText(page.status)}`,
    });
  }

  const fetchFailureRe = /^fetch (.+) failed: (.+)$/;
  const skippedRe = /^skipped (.+): (.+)$/;
  const authPartialRe = /^auth_wall_partial:(\d+)$/;
  const timeoutRe = /^scan_timeout_after_(\d+)ms$/;

  for (const warning of scan.warnings) {
    const fetchMatch = fetchFailureRe.exec(warning);
    if (fetchMatch) {
      issues.push({
        url: fetchMatch[1]!,
        category: classifyWarningCategory(fetchMatch[2]!),
        reason: fetchMatch[2]!,
      });
      continue;
    }

    const skippedMatch = skippedRe.exec(warning);
    if (skippedMatch) {
      issues.push({
        url: skippedMatch[1]!,
        category: classifyWarningCategory(skippedMatch[2]!),
        reason: `skipped: ${skippedMatch[2]!}`,
      });
      continue;
    }

    const authPartialMatch = authPartialRe.exec(warning);
    if (authPartialMatch) {
      issues.push({
        url: "multiple pages",
        category: "Authentication Required",
        reason: `${authPartialMatch[1]!} page(s) were blocked by login/authentication`,
      });
      continue;
    }

    const timeoutMatch = timeoutRe.exec(warning);
    if (timeoutMatch) {
      issues.push({
        url: "scan-level",
        category: "Scan Timeout",
        reason: `scan timed out after ${timeoutMatch[1]!}ms`,
      });
      continue;
    }
  }

  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.url}|${issue.category}|${issue.reason}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function classifyStatusCategory(status: number): string {
  if (status === 401 || status === 403) return "Authentication Required";
  if (status === 404 || status === 410) return "Page Not Reachable";
  if (status === 429) return "Rate Limited";
  if (status >= 500) return "Server Error";
  if (status >= 400) return "Client Error";
  return "Unexpected Status";
}

function classifyWarningCategory(reason: string): string {
  const normalized = reason.toLowerCase();
  if (
    normalized.includes("unauthorized") ||
    normalized.includes("forbidden") ||
    normalized.includes("auth") ||
    normalized.includes("401") ||
    normalized.includes("403")
  ) {
    return "Authentication Required";
  }
  if (normalized.includes("abort") || normalized.includes("timeout") || normalized.includes("timed out")) {
    return "Timeout / Loading Issue";
  }
  if (normalized.includes("content-type")) return "Unsupported Content";
  if (normalized.includes("dns") || normalized.includes("enotfound") || normalized.includes("resolve")) {
    return "DNS / Host Resolution";
  }
  if (normalized.includes("private_host") || normalized.includes("blocked_tld")) {
    return "Security Restriction";
  }
  if (normalized.includes("certificate") || normalized.includes("ssl") || normalized.includes("tls")) {
    return "TLS / Certificate Issue";
  }
  return "Fetch / Loading Issue";
}

function statusText(status: number): string {
  const labels: Record<number, string> = {
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    408: "Request Timeout",
    410: "Gone",
    429: "Too Many Requests",
    500: "Internal Server Error",
    502: "Bad Gateway",
    503: "Service Unavailable",
    504: "Gateway Timeout",
  };
  return labels[status] ?? (status >= 400 && status < 500 ? "Client Error" : "Server Error");
}