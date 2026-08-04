"use client";

import { useAppStore } from "@/store";
import { Button } from "@/components/ui/button";

interface ScanProgressOverlayProps {
  open: boolean;
  onCancel: () => void;
}

const stageLabels: Record<string, string> = {
  idle: "Preparing…",
  crawling: "Crawling site…",
  analyzing: "Analyzing pages…",
  matching: "Matching library…",
  complete: "Done",
  error: "Error",
};

export function ScanProgressOverlay({ open, onCancel }: ScanProgressOverlayProps) {
  const scan = useAppStore((s) => s.scan);
  if (!open) return null;

  const progress = Math.max(0, Math.min(100, scan.progress));
  const label = stageLabels[scan.status] ?? scan.status;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="scan-progress-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-6"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl flex flex-col gap-4">
        <h2 id="scan-progress-title" className="text-xl font-semibold text-black">
          Analyzing your site
        </h2>
        <p className="text-sm text-gray-600">
          {scan.liveUrl ? (
            <>
              We&apos;re scanning{" "}
              <span className="font-medium text-black">{scan.liveUrl}</span> to
              pre-select the components and templates you&apos;ll likely need.
            </>
          ) : (
            "Preparing scan…"
          )}
        </p>

        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-xs text-gray-600">
            <span>{label}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full bg-cobalt transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          {scan.pagesScanned > 0 && (
            <p className="text-xs text-gray-500">
              Pages scanned: {scan.pagesScanned}
            </p>
          )}
        </div>

        {scan.status === "error" && scan.error && (
          <p className="text-sm text-destructive">{scan.error}</p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="h-10 px-4"
          >
            {scan.status === "error" || scan.status === "complete" ? "Close" : "Cancel"}
          </Button>
        </div>
      </div>
    </div>
  );
}
