import { describe, expect, it } from "vitest";
import { getDisplayedProgress } from "./ScanProgressDialog";

describe("getDisplayedProgress", () => {
  it.each([
    ["crawling", 12],
    ["analyzing", 58],
    ["matching", 91],
  ] as const)("shows live progress while %s", (status, progress) => {
    expect(getDisplayedProgress(status, progress)).toBe(progress);
  });

  it("shows 100 when the scan is complete", () => {
    expect(getDisplayedProgress("complete", 96)).toBe(100);
  });
});