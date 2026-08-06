"use client";

import { useAppStore } from "@/store";

type Kind = "components" | "templates";

interface Props {
  kind: Kind;
}

export function ScanSummaryBanner({ kind }: Props) {
  const scan = useAppStore((s) => s.scan);

  if (scan.status !== "complete" || !scan.scanAppliedAt) return null;

  const matchedCount =
    kind === "components"
      ? Object.keys(scan.matchedComponentIds).length
      : Object.keys(scan.matchedTemplateIds).length;

  const unmatched = scan.unmatched.filter((item) =>
    kind === "components" ? item.kind === "component" : item.kind === "template",
  );

  const label = kind === "components" ? "component group" : "template";
  const plural = matchedCount === 1 ? label : `${label}s`;

  const spaDetected = scan.warnings.includes("spa_detected");
  const authPartial = scan.warnings.some((w) => w.startsWith("auth_wall_partial:"));

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
        {unmatched.length > 0 && (
          <details className="text-xs">
            <summary className="cursor-pointer text-cobalt hover:underline">
              {unmatched.length} unmatched item{unmatched.length === 1 ? "" : "s"}
            </summary>
            <ul className="mt-2 max-h-40 list-disc overflow-auto pl-4 text-black/70">
              {unmatched.slice(0, 20).map((u, i) => (
                <li key={`${u.label}-${i}`}>
                  <span className="font-mono">{u.label}</span>
                  {typeof u.confidence === "number" && (
                    <span className="text-black/40"> ({Math.round(u.confidence * 100)}%)</span>
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
    </div>
  );
}
