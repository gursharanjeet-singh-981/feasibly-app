import { describe, expect, it } from "vitest";
import { buildFailedEntries, buildLimitSkippedEntries } from "./exportScanReport";
import { initialScanSliceState, type ScanSliceState } from "@/lib/scanner/types";

const scanWith = (unscannedPages: ScanSliceState["unscannedPages"]): ScanSliceState => ({
  ...initialScanSliceState,
  unscannedPages,
});

describe("page-limit skipped pages in the scan report", () => {
  const scan = scanWith([
    { url: "https://example.com/a", source: "link", reason: "max_pages_limit" },
    { url: "https://example.com/b", source: "link", reason: "max_depth" },
    { url: "https://example.com/c", source: "link", reason: "max_pages_limit" },
  ]);

  it("lists limit-skipped pages separately", () => {
    const limited = buildLimitSkippedEntries(scan).map((e) => e.url);
    expect(limited).toEqual(["https://example.com/a", "https://example.com/c"]);
  });

  it("does not count limit-skipped pages as scan issues", () => {
    const issues = buildFailedEntries(scan, new Map(), "https://example.com/");
    const urls = issues.map((e) => e.url);
    expect(urls).not.toContain("https://example.com/a");
    expect(urls).not.toContain("https://example.com/c");
    // Other skip reasons are still reported as issues.
    expect(urls).toContain("https://example.com/b");
  });

  it("keeps a URL in issues if it was also skipped for another reason", () => {
    const mixed = scanWith([
      { url: "https://example.com/x", source: "link", reason: "max_pages_limit" },
      { url: "https://example.com/x", source: "sitemap", reason: "robots_disallow" },
    ]);
    expect(buildLimitSkippedEntries(mixed)).toEqual([]);
    expect(buildFailedEntries(mixed, new Map(), "https://example.com/").map((e) => e.url)).toContain(
      "https://example.com/x",
    );
  });
});
