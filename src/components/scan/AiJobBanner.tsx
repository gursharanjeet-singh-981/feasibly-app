"use client";

import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store";
import { finishAiJob, pauseAiJob, resumeAiJob } from "@/hooks/aiJob";
import type { AiJobSummary } from "@/lib/scanner/types";

/**
 * Top-of-page status for a whole-site AI job. While the job is running or paused,
 * selection and export are locked; this banner says so and offers Pause, Continue and Finish.
 */
export function AiJobBanner() {
  const job = useAppStore((s) => s.scan.aiJob);
  if (!job) return null;
  return renderStatus(job);
}

function renderStatus(job: AiJobSummary) {
  const remaining = job.pagesRemaining;
  const pagesWord = (n: number) => `${n} page${n === 1 ? "" : "s"}`;

  switch (job.status) {
    case "running":
      return (
        <Panel tone="info">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <p className="font-medium">AI scan of the remaining {pagesWord(remaining)} is still in progress.</p>
              <p className="text-xs opacity-80">
                Selection and export are disabled until the scan finishes or is paused. {job.message}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => pauseAiJob()}>
              Pause after this batch
            </Button>
          </div>
        </Panel>
      );
    case "pausing":
      // Pause takes effect when the current batch ends. Finish is available now; Continue
      // unlocks once the scan is actually paused.
      return (
        <Panel tone="info">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <p className="font-medium">Pausing after this batch completes.</p>
              <p className="text-xs opacity-80">
                {job.message} Selection and export stay locked until the scan is paused or finished.
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" disabled>
                Continue scan
              </Button>
              <Button size="sm" variant="outline" onClick={() => finishAiJob()}>
                Finish scan
              </Button>
            </div>
          </div>
        </Panel>
      );
    case "paused":
      return (
        <Panel tone="info">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <p className="font-medium">Scan paused. {pagesWord(remaining)} not yet scanned.</p>
              <p className="text-xs opacity-80">
                Review the results so far. Continue to scan the next batch, or finish to end the scan here.
                Selection and export unlock when you finish.
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => resumeAiJob()}>
                Continue scan
              </Button>
              <Button size="sm" variant="outline" onClick={() => finishAiJob()}>
                Finish scan
              </Button>
            </div>
          </div>
        </Panel>
      );
    case "finished":
      return (
        <Panel tone="neutral">
          <p className="font-medium">Scan ended. {pagesWord(remaining)} were not scanned.</p>
          <p className="text-xs opacity-80">Selection and export are available for the pages that were scanned.</p>
        </Panel>
      );
    case "stopped":
      return (
        <Panel tone="neutral">
          <p className="font-medium">Scan stopped. {pagesWord(remaining)} not scanned.</p>
          <p className="text-xs opacity-80">Results from completed batches are shown. Selection and export are available.</p>
        </Panel>
      );
    case "error":
      return (
        <Panel tone="warn">
          <p className="font-medium">
            Scan stopped after {job.batchesDone} of {job.totalBatches} batch{job.totalBatches === 1 ? "" : "es"}.
          </p>
          <p className="text-xs opacity-80">
            Reason: {job.error ?? "unknown"}. Results from completed batches are shown. Selection and export are enabled.
          </p>
        </Panel>
      );
    case "complete":
      return null;
  }
}

function Panel({
  tone,
  children,
}: {
  tone: "info" | "neutral" | "warn";
  children: React.ReactNode;
}) {
  const styles = {
    info: "border-cobalt/30 bg-background-blue text-black",
    neutral: "border-strokes/60 bg-white text-black",
    warn: "border-amber-200 bg-amber-50 text-amber-800",
  } as const;
  return <div className={`rounded-lg border px-4 py-3 text-sm ${styles[tone]}`}>{children}</div>;
}
