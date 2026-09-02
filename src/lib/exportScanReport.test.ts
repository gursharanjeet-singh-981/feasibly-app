import { describe, expect, it } from "vitest";
import {
  buildUniqueComponentEntries,
  buildFailedEntries,
  buildUnscannedEntries,
  summarizeScanCoverage,
  summarizeKnownUrlCoverage,
  getDefaultScanSheetNames,
} from "./exportScanReport";
import { initialScanSliceState, type ScanSliceState } from "./scanner/types";

describe("buildFailedEntries", () => {
  it("includes structured unscanned pages so the report cannot claim complete success", () => {
    const scan: ScanSliceState = {
      ...initialScanSliceState,
      status: "complete",
      unscannedPages: [
        {
          url: "https://example.com/hidden",
          source: "sitemap",
          reason: "representative_page",
          detail: "same_route_family; representative=https://example.com/visible",
        },
      ],
    };

    expect(buildFailedEntries(scan, new Map(), "https://example.com/")).toContainEqual({
      url: "https://example.com/hidden",
      title: "—",
      pageType: "—",
      status: "—",
      category: "Unscanned Page",
      reason: "Represented by a similar or primary-locale page",
      action: "Review the representative URL in the technical detail if this route may use a distinct layout. Technical detail: same_route_family; representative=https://example.com/visible",
      source: "unscanned",
    });
  });

  it("maps crawler warning variants to failed-page rows", () => {
    const scan: ScanSliceState = {
      status: "complete",
      progress: 100,
      scanId: "scan-1",
      pagesScanned: 2,
      sitemapUrls: ["https://example.com/about", "https://example.com/contact"],
      representativeUrls: ["https://example.com/about", "https://example.com/contact"],
      scrapedUrls: ["https://example.com/about"],
      unscannedPages: [],
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

    expect(rows).toHaveLength(5);
    expect(rows.map((row) => row.url)).toEqual([
      "https://example.com/about",
      "https://example.com/robots.txt",
      "https://example.com/sitemap.xml",
      "https://example.com/contact",
      "—",
    ]);
    expect(rows.some((row) => row.category === "Scan Cancelled")).toBe(true);
    expect(rows.some((row) => row.category === "Page Not Reachable")).toBe(true);
  });

  it("classifies scanner and request deadlines as timeouts, not cancellations", () => {
    const scan: ScanSliceState = {
      status: "complete",
      progress: 100,
      scanId: "scan-2",
      pagesScanned: 0,
      sitemapUrls: [],
      representativeUrls: [],
      scrapedUrls: [],
      unscannedPages: [],
      discoveredPages: [],
      matchedComponentIds: {},
      matchedTemplateIds: {},
      unmatched: [],
      warnings: [
        "fetch https://example.com/ failed: request_timeout_after_10000ms",
        "scan_timeout_after_180000ms",
      ],
      error: null,
      scanAppliedAt: null,
    };

    const rows = buildFailedEntries(scan, new Map(), "https://example.com/");

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          url: "https://example.com/",
          category: "Timeout / Loading Issue",
          reason: "Request timed out after 10000ms.",
        }),
        expect.objectContaining({ category: "Scan Timeout" }),
      ]),
    );
    expect(rows.some((row) => row.category === "Scan Cancelled")).toBe(false);
  });

  it("includes summary and similar-page warnings when they are counted in the scan", () => {
    const scan: ScanSliceState = {
      status: "complete",
      progress: 100,
      scanId: "scan-3",
      pagesScanned: 0,
      sitemapUrls: [],
      representativeUrls: [],
      scrapedUrls: [],
      unscannedPages: [],
      discoveredPages: [],
      matchedComponentIds: {},
      matchedTemplateIds: {},
      unmatched: [],
      warnings: [
        "sitemap_skip_summary max_pages_limit: 3",
        "similar_skip https://example.com/product/123: path_template_limit",
        "Crawl aborted",
        "no_pages_fetched",
        "cookie_consent_detected:https://example.com/",
        "spa_detected",
      ],
      error: null,
      scanAppliedAt: null,
    };

    const rows = buildFailedEntries(scan, new Map(), "https://example.com/");

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "Sitemap Coverage Gap",
          reason: expect.stringContaining("3 sitemap URLs were skipped because the maximum page limit was reached"),
        }),
        expect.objectContaining({ category: "Scan Cancelled", reason: "Crawl aborted" }),
        expect.objectContaining({
          category: "No Pages Fetched",
          reason: "No pages were successfully fetched during the scan.",
        }),
        expect.objectContaining({
          category: "Cookie Consent Detected",
          reason: expect.stringContaining("Cookie consent banner detected"),
        }),
        expect.objectContaining({
          category: "Potential SPA / Thin Content",
          reason: expect.stringContaining("client-rendered or thin-content based"),
        }),
      ]),
    );
  });

  it("converts duplicate-template skips into a valid human reason without a recommended action", () => {
    const scan: ScanSliceState = {
      status: "complete",
      progress: 100,
      scanId: "scan-4",
      pagesScanned: 0,
      sitemapUrls: [],
      representativeUrls: [],
      scrapedUrls: [],
      unscannedPages: [],
      discoveredPages: [],
      matchedComponentIds: {},
      matchedTemplateIds: {},
      unmatched: [],
      warnings: ["similar_skip https://example.com/product/123: path_template_limit"],
      error: null,
      scanAppliedAt: null,
    };

    const rows = buildFailedEntries(scan, new Map(), "https://example.com/");

    expect(rows).toContainEqual(
      expect.objectContaining({
        url: "https://example.com/product/123",
        category: "Similar Page Skipped",
        reason: "This page matches an existing route pattern and was intentionally skipped to keep the crawl focused.",
      }),
    );
    expect(rows[0]).not.toHaveProperty("action");
  });
});

describe("buildUnscannedEntries", () => {
  it("reports and deduplicates every known URL that was not scanned", () => {
    const entries = buildUnscannedEntries([
      { url: "https://example.com/b", source: "link", reason: "max_depth" },
      { url: "https://example.com/a", source: "sitemap", reason: "max_pages_limit" },
      { url: "https://example.com/a", source: "link", reason: "max_pages_limit" },
    ]);

    expect(entries).toEqual([
      {
        url: "https://example.com/a",
        source: "sitemap",
        reason: "Maximum scan page limit reached",
        action: "Run a narrower scan or increase the configured page limit.",
      },
      {
        url: "https://example.com/b",
        source: "link",
        reason: "Beyond the configured crawl depth",
        action: "Run a scan from a closer parent page or increase the crawl depth.",
      },
    ]);
  });
});

describe("summarizeKnownUrlCoverage", () => {
  it("counts unique sitemap, scraped, and link-discovered URLs", () => {
    const scan = {
      sitemapUrls: ["https://example.com/", "https://example.com/a"],
      scrapedUrls: ["https://example.com/"],
      unscannedPages: [
        { url: "https://example.com/a", source: "sitemap" as const, reason: "max_pages_limit" as const },
        { url: "https://example.com/b", source: "link" as const, reason: "max_depth" as const },
      ],
    } as ScanSliceState;

    expect(summarizeKnownUrlCoverage(scan)).toEqual({ known: 3, scanned: 1, percentage: 33 });
  });
});

describe("summarizeScanCoverage", () => {
  it("separates discovered sitemap URLs, selected representatives, scanned pages, and remaining routes", () => {
    const scan = {
      ...initialScanSliceState,
      sitemapUrls: ["https://example.com/gb/about", "https://example.com/gb/products/a", "https://example.com/fr/products/a"],
      representativeUrls: ["https://example.com/gb/about", "https://example.com/gb/products/a"],
      scrapedUrls: ["https://example.com/gb/about"],
      unscannedPages: [
        { url: "https://example.com/gb/products/a", source: "sitemap" as const, reason: "fetch_failed" as const },
        { url: "https://example.com/fr/products/a", source: "sitemap" as const, reason: "representative_page" as const },
      ],
    };

    expect(summarizeScanCoverage(scan)).toEqual({
      sitemapUrls: 3,
      selectedForScan: 2,
      scanned: 1,
      selectedRemaining: 1,
      unscanned: 2,
    });
  });

  it("does not count URLs rejected by pre-fetch sampling as selected or left to scan", () => {
    const scan = {
      ...initialScanSliceState,
      sitemapUrls: ["https://example.com/about", "https://example.com/products/a", "https://example.com/products/b"],
      representativeUrls: ["https://example.com/about", "https://example.com/products/a", "https://example.com/products/b"],
      scrapedUrls: ["https://example.com/about"],
      unscannedPages: [
        { url: "https://example.com/products/a", source: "sitemap" as const, reason: "path_template_limit" as const },
        { url: "https://example.com/products/b", source: "sitemap" as const, reason: "fetch_failed" as const },
      ],
    };

    expect(summarizeScanCoverage(scan)).toEqual({
      sitemapUrls: 3,
      selectedForScan: 2,
      scanned: 1,
      selectedRemaining: 1,
      unscanned: 2,
    });
  });
});

describe("buildUniqueComponentEntries", () => {
  it("consolidates each matched component variant and preserves all detected pages", () => {
    const scan = {
      ...initialScanSliceState,
      matchedComponentIds: {
        1: { confidence: 0.9, group: "CTA", pages: ["https://example.com/", "https://example.com/about"] },
        2: { confidence: 0.8, group: "CTA", pages: ["https://example.com/"] },
      },
    };
    const components = [
      { id: 1, group: "CTA", name: "Primary CTA" },
      { id: 2, group: "CTA", name: "Secondary CTA" },
    ] as never;

    expect(buildUniqueComponentEntries(scan, components)).toEqual([
      {
        group: "CTA",
        variant: "Primary CTA",
        confidence: "90%",
        pageCount: 2,
        pageUrls: "https://example.com/\nhttps://example.com/about",
      },
      {
        group: "CTA",
        variant: "Secondary CTA",
        confidence: "80%",
        pageCount: 1,
        pageUrls: "https://example.com/",
      },
    ]);
  });
});

describe("getDefaultScanSheetNames", () => {
  it("returns the default clean scan workbook sheet set", () => {
    expect(getDefaultScanSheetNames()).toEqual([
      "Scan Overview",
      "Detected Components",
      "Templates",
      "Unmatched Items",
      "Issues",
    ]);
  });
});
