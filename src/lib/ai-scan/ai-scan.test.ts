import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("node:dns", () => ({
  promises: { lookup: vi.fn().mockResolvedValue([{ address: "93.184.216.34", family: 4 }]) },
}));

import type { Component, Template } from "@/types";
import { cleanHtmlForModel } from "./cleanHtml";
import { clusterPages, jaccard, pickSamples, type PageFingerprint } from "./cluster";
import { reserveDailyAiCall, resetDailyAiBudget, dailyAiCallsUsed } from "./budget";
import { mergeAiResults } from "./merge";
import { AiProviderError, createAiClassifier, parseDetections } from "./provider";
import { orchestrateAiScan } from "./orchestrator";
import { AI_SCAN_CONFIG } from "./config";
import type { PageAnalysis, ScanStreamEvent } from "@/lib/scanner/types";

const libraryRoot = path.join(process.cwd(), "public", "data");
const library = {
  components: JSON.parse(readFileSync(path.join(libraryRoot, "components.json"), "utf8")) as Component[],
  templates: JSON.parse(readFileSync(path.join(libraryRoot, "templates.json"), "utf8")) as Template[],
};
const groups = [...new Set(library.components.map((c) => c.group))];

describe("cleanHtmlForModel", () => {
  it("removes scripts and styles, keeps signal attributes, drops noise", () => {
    const html = `<html><head><style>.x{}</style></head><body>
      <script>alert(1)</script>
      <div class="hero" style="color:red" data-tracking="abc"><button aria-label="Shop now">Shop</button></div>
      <!-- comment -->
    </body></html>`;
    const out = cleanHtmlForModel(html, 10_000);
    expect(out).not.toContain("alert");
    expect(out).not.toContain("<style");
    expect(out).not.toContain("color:red");
    expect(out).not.toContain("data-tracking");
    expect(out).not.toContain("comment");
    expect(out).toContain('class="hero"');
    expect(out).toContain('aria-label="Shop now"');
  });

  it("caps output length", () => {
    const html = `<body>${"<p>x</p>".repeat(5000)}</body>`;
    expect(cleanHtmlForModel(html, 500).length).toBeLessThanOrEqual(500);
  });
});

describe("jaccard and clustering", () => {
  it("computes set similarity", () => {
    expect(jaccard(new Set(["a", "b"]), new Set(["a", "b"]))).toBe(1);
    expect(jaccard(new Set(["a"]), new Set(["b"]))).toBe(0);
    expect(jaccard(new Set(["a", "b", "c"]), new Set(["a", "b"]))).toBeCloseTo(2 / 3);
  });

  const fp = (url: string, template: string, groupsList: string[], pageType: PageFingerprint["pageType"] = "product"): PageFingerprint => ({
    url,
    pageType,
    template,
    groups: new Set(groupsList),
  });

  it("groups similar pages of the same template and separates different ones", () => {
    const pages = [
      fp("https://x/p/1", "/p", ["CTA", "Title", "Image", "Text"]),
      fp("https://x/p/2", "/p", ["CTA", "Title", "Image", "Text"]),
      fp("https://x/p/3", "/p", ["CTA", "Title", "Image", "Text"]),
      fp("https://x/q/1", "/q", ["Forms"]),
    ];
    const clusters = clusterPages(pages, AI_SCAN_CONFIG.clusterSimilarity);
    expect(clusters).toHaveLength(2);
    expect(clusters[0]!.map((p) => p.url)).toEqual([
      "https://x/p/1",
      "https://x/p/2",
      "https://x/p/3",
    ]);
  });

  it("does not merge pages with dissimilar component sets", () => {
    const pages = [
      fp("https://x/p/1", "/p", ["CTA", "Title"]),
      fp("https://x/p/2", "/p", ["Forms", "Search", "Tabs"]),
    ];
    expect(clusterPages(pages, 0.8)).toHaveLength(2);
  });

  it("samples the medoid, plus an outlier for large clusters", () => {
    const small = [fp("https://x/p/1", "/p", ["A", "B"]), fp("https://x/p/2", "/p", ["A", "B"])];
    expect(pickSamples(small, 10)).toEqual(["https://x/p/1"]);

    const big = Array.from({ length: 11 }, (_, i) => fp(`https://x/p/${i}`, "/p", ["A", "B"]));
    big.push(fp("https://x/p/odd", "/p", ["Z"]));
    const samples = pickSamples(big, 10);
    expect(samples).toHaveLength(2);
    expect(samples).toContain("https://x/p/odd");
  });
});

describe("parseDetections", () => {
  it("accepts a valid response and canonicalises group names", () => {
    const text = JSON.stringify({
      components: [{ groupName: "cta", confidence: 0.9, evidence: "button" }],
    });
    const out = parseDetections(text, groups);
    expect(out).toHaveLength(1);
    expect(out[0]!.groupName).toBe("CTA");
    expect(out[0]!.confidence).toBe(0.9);
  });

  it("strips markdown code fences", () => {
    const text = "```json\n" + JSON.stringify({ components: [{ groupName: "Forms" }] }) + "\n```";
    expect(parseDetections(text, groups)[0]!.groupName).toBe("Forms");
  });

  it("drops names that are not in the library", () => {
    const text = JSON.stringify({ components: [{ groupName: "Made Up Widget" }] });
    expect(parseDetections(text, groups)).toEqual([]);
  });

  it("keeps the highest confidence for duplicates and clamps out-of-range values", () => {
    const text = JSON.stringify({
      components: [
        { groupName: "Forms", confidence: 0.4 },
        { groupName: "Forms", confidence: 3 },
      ],
    });
    const out = parseDetections(text, groups);
    expect(out).toHaveLength(1);
    expect(out[0]!.confidence).toBe(1);
  });

  it("throws a non-retryable error on invalid JSON or shape", () => {
    expect(() => parseDetections("not json", groups)).toThrow(AiProviderError);
    expect(() => parseDetections('{"wrong":1}', groups)).toThrow(AiProviderError);
  });
});

describe("createAiClassifier", () => {
  it("throws when no provider key is configured", () => {
    expect(() =>
      createAiClassifier({ allowedGroups: groups, allowedTemplates: [], gemini: { model: "m" }, groq: { model: "m" } }),
    ).toThrow(/ai_not_configured/);
  });

  it("falls back to Groq when Gemini returns 429", async () => {
    const calls: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("generativelanguage")) return new Response("quota", { status: 429 });
      return new Response(
        JSON.stringify({ choices: [{ message: { content: JSON.stringify({ components: [{ groupName: "Forms" }] }) } }] }),
        { status: 200 },
      );
    };
    const classifier = createAiClassifier({
      allowedGroups: groups, allowedTemplates: [],
      fetchImpl,
      gemini: { model: "gemini-test", apiKey: "g" },
      groq: { model: "groq-test", apiKey: "k" },
    });
    const out = await classifier.classify({ url: "https://x/", html: "<form></form>" });
    expect(out.provider).toBe("groq");
    expect(out.detections[0]!.groupName).toBe("Forms");
    expect(calls.some((c) => c.includes("generativelanguage"))).toBe(true);
    expect(calls.some((c) => c.includes("api.groq.com"))).toBe(true);
  });
});

describe("daily budget", () => {
  beforeEach(() => resetDailyAiBudget());

  it("stops at the daily cap and resets on a new UTC day", () => {
    const day1 = new Date("2026-11-05T10:00:00Z");
    for (let i = 0; i < AI_SCAN_CONFIG.dailyAiCallCaps.gemini; i++) {
      expect(reserveDailyAiCall("gemini", day1)).toBe(true);
    }
    expect(reserveDailyAiCall("gemini", day1)).toBe(false);
    expect(dailyAiCallsUsed("gemini", day1)).toBe(AI_SCAN_CONFIG.dailyAiCallCaps.gemini);
    expect(reserveDailyAiCall("gemini", new Date("2026-11-06T00:00:01Z"))).toBe(true);
  });
});

describe("mergeAiResults", () => {
  const analysis = (url: string, detected: [string, number][]): PageAnalysis => ({
    url,
    pageType: "product",
    detectedComponents: detected.map(([groupName, confidence]) => ({
      groupName,
      confidence,
      source: "heuristic",
    })),
    detectedTemplate: null,
  });

  it("never removes heuristic detections and adds AI ones with reduced confidence for members", () => {
    const analyses = [
      analysis("https://x/p/1", [["CTA", 0.8]]),
      analysis("https://x/p/2", [["CTA", 0.8]]),
    ];
    const merged = mergeAiResults(
      analyses,
      [
        {
          sourceUrl: "https://x/p/1",
          memberUrls: ["https://x/p/2"],
          detections: [{ groupName: "Forms", confidence: 0.9, evidence: "form" }],
          template: null,
        },
      ],
      0.5,
    );
    const p1 = merged[0]!.detectedComponents.map((d) => d.groupName).sort();
    expect(p1).toEqual(["CTA", "Forms"]);
    const formOnP2 = merged[1]!.detectedComponents.find((d) => d.groupName === "Forms");
    expect(formOnP2?.confidence).toBeCloseTo(0.45);
    expect(formOnP2?.source).toBe("ai");
    expect(merged[1]!.detectedComponents.find((d) => d.groupName === "CTA")?.confidence).toBe(0.8);
  });
});

describe("orchestrateAiScan", () => {
  const homepage = `<!doctype html><html><head><title>Home</title></head><body>
    <h1>Home</h1><a href="/p/1">one</a><a href="/p/2">two</a><a href="/p/3">three</a>
    <p>a</p><p>b</p><p>c</p></body></html>`;
  const productPage = (n: number) => `<!doctype html><html><head><title>Product ${n}</title></head><body>
    <h1>Product ${n}</h1><button class="btn">Add to cart</button><form><input type="search"></form>
    <p>one</p><p>two</p><p>three</p></body></html>`;

  function siteFetch(extraPages: Record<string, string> = {}) {
    const routes: Record<string, string> = {
      "https://example.com/": homepage,
      "https://example.com/p/1": productPage(1),
      "https://example.com/p/2": productPage(2),
      "https://example.com/p/3": productPage(3),
      ...extraPages,
    };
    const stub: typeof fetch = async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      const body = routes[url];
      if (body === undefined) return new Response("nope", { status: 404 });
      return new Response(body, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
    };
    return stub;
  }

  async function collect(gen: AsyncGenerator<ScanStreamEvent>) {
    const events: ScanStreamEvent[] = [];
    for await (const e of gen) events.push(e);
    return events;
  }

  beforeEach(() => resetDailyAiBudget());

  it("whole-site: crawls all pages, runs AI on samples, and returns a matched result", async () => {
    const seen: string[] = [];
    const classifier = {
      classify: vi.fn(async ({ url }: { url: string }) => {
        seen.push(url);
        return {
          provider: "gemini" as const, template: null,
          detections: [{ groupName: "Forms", confidence: 0.9, evidence: "form present" }],
        };
      }),
    };
    const events = await collect(
      orchestrateAiScan({
        url: "https://example.com/",
        mode: "full",
        library,
        classifier,
        crawlOptions: { fetchImpl: siteFetch(), jitterMs: () => 0 },
      }),
    );
    const complete = events.find((e) => e.type === "complete");
    expect(complete?.type).toBe("complete");
    if (complete?.type !== "complete") return;
    const result = complete.result;

    expect(result.pagesScanned).toBe(4);
    // The three product pages are structurally identical, so one AI sample covers them.
    expect(seen.length).toBeLessThanOrEqual(2);
    expect(seen.length).toBeLessThanOrEqual(AI_SCAN_CONFIG.maxAiCallsPerBatch);
    expect(result.warnings.some((w) => w.startsWith("ai_scan:mode=full"))).toBe(true);
    expect(Object.keys(result.matchedComponentIds).length).toBeGreaterThan(0);
  });

  it("single page: makes at most one AI call", async () => {
    const classifier = {
      classify: vi.fn(async () => ({ provider: "groq" as const, template: null, detections: [] })),
    };
    const events = await collect(
      orchestrateAiScan({
        url: "https://example.com/p/1",
        mode: "single",
        library,
        classifier,
        crawlOptions: { fetchImpl: siteFetch(), jitterMs: () => 0 },
      }),
    );
    expect(classifier.classify).toHaveBeenCalledTimes(1);
    expect(events.at(-1)?.type).toBe("complete");
  });

  it("keeps heuristic results and records a warning when AI fails", async () => {
    const classifier = {
      classify: vi.fn(async () => {
        throw new AiProviderError("gemini_http_500", true);
      }),
    };
    const events = await collect(
      orchestrateAiScan({
        url: "https://example.com/",
        mode: "full",
        library,
        classifier,
        crawlOptions: { fetchImpl: siteFetch(), jitterMs: () => 0 },
      }),
    );
    const complete = events.find((e) => e.type === "complete");
    if (complete?.type !== "complete") throw new Error("expected complete event");
    expect(complete.result.warnings.some((w) => w.startsWith("ai_failed:"))).toBe(true);
    // Heuristics still matched components on the pages, so the scan is not empty.
    expect(Object.keys(complete.result.matchedComponentIds).length).toBeGreaterThan(0);
  });

  it("respects the per-scan AI call cap", async () => {
    // Many distinct page types/templates, so many clusters, each needing a sample.
    const extra: Record<string, string> = {};
    const links: string[] = [];
    for (let i = 0; i < 40; i++) {
      const url = `https://example.com/section${i}/item/page`;
      links.push(`<a href="/section${i}/item/page">x</a>`);
      extra[url] = `<!doctype html><html><body><h1>S${i}</h1>${i % 2 ? "<form></form>" : "<button>Buy</button>"}<nav class="x${i}"></nav><p>a</p></body></html>`;
    }
    const home = `<!doctype html><html><body>${links.join("")}</body></html>`;
    const fetchImpl = siteFetch({ ...extra, "https://example.com/": home });
    const classifier = {
      classify: vi.fn(async () => ({ provider: "gemini" as const, template: null, detections: [] })),
    };
    const events = await collect(
      orchestrateAiScan({
        url: "https://example.com/",
        mode: "full",
        library,
        classifier,
        crawlOptions: { fetchImpl, jitterMs: () => 0 },
      }),
    );
    expect(classifier.classify.mock.calls.length).toBeLessThanOrEqual(AI_SCAN_CONFIG.maxAiCallsPerBatch);
    expect(events.at(-1)?.type).toBe("complete");
  });
});
