import type { AiJobStatus, ScanSliceState } from "./types";

/** A job that is still working or waiting for the user to continue or finish. */
export function isAiJobActive(status: AiJobStatus): boolean {
  return status === "running" || status === "pausing" || status === "paused";
}

/** Selection and export are locked while an AI job is active, so the report cannot change under the user. */
export function isScanLocked(scan: Pick<ScanSliceState, "aiJob">): boolean {
  return scan.aiJob !== null && isAiJobActive(scan.aiJob.status);
}
