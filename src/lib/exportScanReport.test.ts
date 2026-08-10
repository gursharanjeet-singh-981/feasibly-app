import { describe, expect, it } from "vitest";
import { buildFailedEntries } from "./exportScanReport";
import type { ScanSliceState } from "./scanner/types";

describe("buildFailedEntries", () => {
  it("maps crawler warning variants to failed-page rows", () => {
    const scan: ScanSliceState = {
      status: "complete",
      progress: 100,
      scanId: "scan-1",
      pagesScanned: 2,
      sitemapUrls: ["https://example.com/about", "https://example.com/contact"],
      scrapedUrls: ["https://example.com/about"],
      discoveredPages: [
        {
          url: "https://example.com/about",
          title: "About",
          pageType: "other",
          depth: 1,
          status: 404,
        },
      ],
      matchedComponentIds: {},
      matchedTemplateIds: {},
      unmatched: [],
      warnings: [
        "robots.txt fetch failed: network down",
        "sitemap https://example.com/sitemap.xml failed: timeout",
        "fetch https://example.com/contact failed: aborted",
        "sitemap_skip https://example.com/gb/private: robots_disallow",
        "sitemap_skip https://example.com/gb/open: max_pages_limit",
        "Crawl aborted",
      ],
      error: null,
      scanAppliedAt: null,
    };

    const rows = buildFailedEntries(scan, new Map(), "https://example.com/");

    expect(rows).toHaveLength(4);
    expect(rows.map((row) => row.url)).toEqual([
      "https://example.com/about",
      "https://example.com/robots.txt",
      "https://example.com/sitemap.xml",
      "https://example.com/contact",
    ]);
    expect(rows.some((row) => row.category === "Scan Cancelled")).toBe(true);
    expect(rows.some((row) => row.category === "Page Not Reachable")).toBe(true);
  });
});
