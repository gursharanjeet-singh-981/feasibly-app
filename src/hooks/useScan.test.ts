import { describe, expect, it } from "vitest";
import { applyEventToState, parseSseChunk } from "./useScan";
import { initialScanSliceState, type ScanResult } from "@/lib/scanner/types";

describe("parseSseChunk", () => {
  it("returns events and empty remainder for complete frames", () => {
    const chunk =
      `data: ${JSON.stringify({ type: "progress", stage: "crawl", progress: 5, message: "start" })}\n\n` +
      `data: ${JSON.stringify({ type: "progress", stage: "analyze", progress: 40, message: "analyze" })}\n\n`;
    const { events, remainder } = parseSseChunk(chunk);
    expect(remainder).toBe("");
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ type: "progress", stage: "crawl", progress: 5 });
    expect(events[1]).toMatchObject({ type: "progress", stage: "analyze", progress: 40 });
  });

  it("keeps an incomplete frame in the remainder", () => {
    const chunk =
      `data: ${JSON.stringify({ type: "progress", stage: "crawl", progress: 5, message: "" })}\n\n` +
      `data: {"type":"progress","stage":"anal`;
    const { events, remainder } = parseSseChunk(chunk);
    expect(events).toHaveLength(1);
    expect(remainder).toContain('"type":"progress","stage":"anal');
  });

  it("ignores malformed JSON frames without throwing", () => {
    const chunk =
      `data: not-json\n\n` +
      `data: ${JSON.stringify({ type: "error", message: "boom" })}\n\n`;
    const { events } = parseSseChunk(chunk);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: "error", message: "boom" });
  });

  it("skips frames without a data: line (comments, retries)", () => {
    const chunk =
      `: heartbeat\n\n` +
      `retry: 1000\n\n` +
      `data: ${JSON.stringify({ type: "progress", stage: "match", progress: 90, message: "" })}\n\n`;
    const { events, remainder } = parseSseChunk(chunk);
    expect(remainder).toBe("");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ stage: "match" });
  });
});

describe("applyEventToState", () => {
  const now = () => "2026-08-05T12:00:00.000Z";

  it("progress event updates status, progress, pagesScanned", () => {
    const next = applyEventToState(
      initialScanSliceState,
      { type: "progress", stage: "crawl", progress: 12, message: "", pagesScanned: 3 },
      now,
    );
    expect(next.status).toBe("crawling");
    expect(next.progress).toBe(12);
    expect(next.pagesScanned).toBe(3);
  });

  it("progress event preserves prior pagesScanned when undefined", () => {
    const seeded = { ...initialScanSliceState, pagesScanned: 7 };
    const next = applyEventToState(
      seeded,
      { type: "progress", stage: "analyze", progress: 60, message: "" },
      now,
    );
    expect(next.pagesScanned).toBe(7);
    expect(next.status).toBe("analyzing");
  });

  it("complete event writes result, stamps scanAppliedAt, clears error", () => {
    const result: ScanResult = {
      scanId: "abc-123",
      liveUrl: "https://x.com/",
      scanDate: "2026-08-05T11:00:00.000Z",
      scanDuration: 1234,
      pagesScanned: 4,
      discoveredPages: [],
      matchedComponentIds: { 1: { confidence: 0.9, pages: ["https://x.com/"] } },
      matchedTemplateIds: { 2: { confidence: 0.8, pages: ["https://x.com/"] } },
      unmatched: [],
      warnings: ["ok"],
    };
    const next = applyEventToState(
      { ...initialScanSliceState, error: "old" },
      { type: "complete", result },
      now,
    );
    expect(next.status).toBe("complete");
    expect(next.progress).toBe(100);
    expect(next.scanId).toBe("abc-123");
    expect(next.matchedComponentIds).toEqual(result.matchedComponentIds);
    expect(next.matchedTemplateIds).toEqual(result.matchedTemplateIds);
    expect(next.warnings).toEqual(["ok"]);
    expect(next.error).toBeNull();
    expect(next.scanAppliedAt).toBe("2026-08-05T12:00:00.000Z");
  });

  it("error event sets status to error and stores message", () => {
    const next = applyEventToState(
      initialScanSliceState,
      { type: "error", message: "rate_limited" },
      now,
    );
    expect(next.status).toBe("error");
    expect(next.error).toBe("rate_limited");
  });
});
