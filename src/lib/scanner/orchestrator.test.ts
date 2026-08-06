import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("node:dns", () => ({
  promises: { lookup: vi.fn().mockResolvedValue([{ address: "93.184.216.34", family: 4 }]) },
}));

import type { Component, Template } from "@/types";
import { orchestrateScan } from "./orchestrator";
import type {
  ScanCompleteEvent,
  ScanErrorEvent,
  ScanProgressEvent,
  ScanStreamEvent,
} from "./types";

const libraryRoot = path.join(process.cwd(), "public", "data");
const library = {
  components: JSON.parse(readFileSync(path.join(libraryRoot, "components.json"), "utf8")) as Component[],
  templates: JSON.parse(readFileSync(path.join(libraryRoot, "templates.json"), "utf8")) as Template[],
};

const noJitter = () => 0;

function makeFetchStub(routes: Record<string, { status?: number; contentType?: string; body: string }>) {
  const calls: string[] = [];
  const stub: typeof fetch = async (input) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push(url);
    const r = routes[url];
    if (!r) return new Response("nope", { status: 404 });
    return new Response(r.body, {
      status: r.status ?? 200,
      headers: { "content-type": r.contentType ?? "text/html; charset=utf-8" },
    });
  };
  return { stub, calls };
}

async function collect(gen: AsyncGenerator<ScanStreamEvent>): Promise<ScanStreamEvent[]> {
  const events: ScanStreamEvent[] = [];
  for await (const e of gen) events.push(e);
  return events;
}

function homepageHtml(links: string[] = []) {
  const anchors = links.map((h) => `<a href="${h}" class="cta">go</a>`).join("");
  return `<!doctype html><html><head><title>Home</title></head>
    <body>
      <nav><a href="/">Home</a><a href="/products">Shop</a></nav>
      ${anchors}
      <div class="carousel"><div class="carousel-item">a</div></div>
      <details><summary>Q</summary><p>A</p></details>
      <details><summary>Q2</summary><p>A2</p></details>
      <details><summary>Q3</summary><p>A3</p></details>
    </body></html>`;
}

describe("orchestrateScan", () => {
  it("emits progress events, then complete, and produces a well-formed ScanResult", async () => {
    const routes = {
      "https://example.com/robots.txt": { body: "" },
      "https://example.com/sitemap.xml": { status: 404, body: "" },
      "https://example.com/sitemap_index.xml": { status: 404, body: "" },
      "https://example.com/": { body: homepageHtml(["/about", "/pricing"]) },
      "https://example.com/about": { body: `<html><title>About</title><body><h1>About</h1></body></html>` },
      "https://example.com/pricing": { body: `<html><title>Pricing</title><body><a class="cta">Buy</a></body></html>` },
    };
    const { stub } = makeFetchStub(routes);

    const events = await collect(
      orchestrateScan({
        url: "https://example.com/",
        library,
        crawlOptions: { fetchImpl: stub, jitterMs: noJitter, maxPages: 10 },
        now: () => 1_700_000_000_000,
        idFactory: () => "scan-fixed-id",
      }),
    );

    const progressEvents = events.filter((e): e is ScanProgressEvent => e.type === "progress");
    const completeEvents = events.filter((e): e is ScanCompleteEvent => e.type === "complete");
    expect(progressEvents.length).toBeGreaterThan(0);
    expect(completeEvents).toHaveLength(1);

    // Stages appear in order: crawl -> analyze -> match -> done
    const stages = progressEvents.map((e) => e.stage);
    const firstCrawl = stages.indexOf("crawl");
    const firstAnalyze = stages.indexOf("analyze");
    const firstMatch = stages.indexOf("match");
    const firstDone = stages.indexOf("done");
    expect(firstCrawl).toBeGreaterThanOrEqual(0);
    expect(firstAnalyze).toBeGreaterThan(firstCrawl);
    expect(firstMatch).toBeGreaterThan(firstAnalyze);
    expect(firstDone).toBeGreaterThan(firstMatch);

    // Progress is monotonically non-decreasing.
    let prev = -1;
    for (const p of progressEvents) {
      expect(p.progress).toBeGreaterThanOrEqual(prev);
      prev = p.progress;
    }
    expect(progressEvents.at(-1)?.progress).toBe(100);

    const result = completeEvents[0].result;
    expect(result.scanId).toBe("scan-fixed-id");
    expect(result.liveUrl).toBe("https://example.com/");
    expect(result.pagesScanned).toBeGreaterThan(0);
    expect(result.discoveredPages.length).toBe(result.pagesScanned);
    // CTA + Carousel + Accordion should have been detected heuristically.
    const ctaIds = library.components.filter((c) => c.group === "CTA").map((c) => c.id);
    const anyCta = ctaIds.some((id) => result.matchedComponentIds[id]);
    expect(anyCta).toBe(true);
  });

  it("emits an error event when the initial URL is blocked by the SSRF guard", async () => {
    const events = await collect(
      orchestrateScan({
        url: "http://localhost/",
        library,
        crawlOptions: { fetchImpl: makeFetchStub({}).stub, jitterMs: noJitter },
      }),
    );
    const errs = events.filter((e): e is ScanErrorEvent => e.type === "error");
    expect(errs).toHaveLength(1);
    expect(events.find((e) => e.type === "complete")).toBeUndefined();
  });

  it("returns an empty complete result (not an error) when no pages are fetched", async () => {
    // fetchImpl throws for the base URL → crawler records the failure and yields 0 pages.
    const stub: typeof fetch = async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url === "https://example.com/robots.txt") return new Response("", { status: 200 });
      if (url.endsWith("sitemap.xml") || url.endsWith("sitemap_index.xml"))
        return new Response("", { status: 404 });
      throw new Error("network down");
    };
    const events = await collect(
      orchestrateScan({
        url: "https://example.com/",
        library,
        crawlOptions: { fetchImpl: stub, jitterMs: noJitter },
      }),
    );
    const complete = events.find((e): e is ScanCompleteEvent => e.type === "complete");
    expect(complete).toBeDefined();
    expect(complete?.result.pagesScanned).toBe(0);
    expect(complete?.result.warnings).toContain("no_pages_fetched");
  });

  it("aborts crawling when an external AbortSignal fires", async () => {
    const routes: Record<string, { status?: number; body: string; contentType?: string }> = {
      "https://example.com/robots.txt": { body: "" },
      "https://example.com/sitemap.xml": { status: 404, body: "" },
      "https://example.com/sitemap_index.xml": { status: 404, body: "" },
      "https://example.com/": { body: homepageHtml() },
    };
    // Slow fetch stub that respects AbortSignal so the crawler can be interrupted.
    const stub: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      const r = routes[url as keyof typeof routes];
      if (!r) return new Response("nope", { status: 404 });
      return new Promise((resolve, reject) => {
        const t = setTimeout(
          () =>
            resolve(
              new Response(r.body, {
                status: r.status ?? 200,
                headers: { "content-type": r.contentType ?? "text/html" },
              }),
            ),
          200,
        );
        init?.signal?.addEventListener("abort", () => {
          clearTimeout(t);
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    };
    const ac = new AbortController();
    const gen = orchestrateScan({
      url: "https://example.com/",
      library,
      crawlOptions: { fetchImpl: stub, jitterMs: noJitter, maxPages: 5 },
      signal: ac.signal,
    });
    // Abort just after the generator starts.
    setTimeout(() => ac.abort(), 5);
    const events = await collect(gen);
    // Either an error event or a complete with no_pages_fetched warning is acceptable.
    const hasError = events.some((e) => e.type === "error");
    const complete = events.find((e): e is ScanCompleteEvent => e.type === "complete");
    expect(hasError || complete?.result.warnings.includes("no_pages_fetched")).toBe(true);
  });

  it("emits an auth_required error when every fetched page returns 401/403", async () => {
    const loginBody = homepageHtml();
    const routes = {
      "https://example.com/robots.txt": { body: "" },
      "https://example.com/sitemap.xml": { status: 404, body: "" },
      "https://example.com/sitemap_index.xml": { status: 404, body: "" },
      "https://example.com/": { status: 401, body: loginBody },
    };
    const { stub } = makeFetchStub(routes);

    const events = await collect(
      orchestrateScan({
        url: "https://example.com/",
        library,
        crawlOptions: { fetchImpl: stub, jitterMs: noJitter, maxPages: 5 },
      }),
    );
    const err = events.find((e): e is ScanErrorEvent => e.type === "error");
    expect(err).toBeDefined();
    expect(err?.message).toBe("auth_required");
    expect(events.find((e) => e.type === "complete")).toBeUndefined();
  });

  it("records an auth_wall_partial warning when only some pages are auth-blocked", async () => {
    const routes = {
      "https://example.com/robots.txt": { body: "" },
      "https://example.com/sitemap.xml": { status: 404, body: "" },
      "https://example.com/sitemap_index.xml": { status: 404, body: "" },
      "https://example.com/": { body: homepageHtml(["/account"]) },
      "https://example.com/account": {
        status: 403,
        body: `<html><title>Login</title><body><h1>Sign in</h1></body></html>`,
      },
    };
    const { stub } = makeFetchStub(routes);
    const events = await collect(
      orchestrateScan({
        url: "https://example.com/",
        library,
        crawlOptions: { fetchImpl: stub, jitterMs: noJitter, maxPages: 10 },
      }),
    );
    const complete = events.find((e): e is ScanCompleteEvent => e.type === "complete");
    expect(complete).toBeDefined();
    expect(complete!.result.warnings.some((w) => w.startsWith("auth_wall_partial:"))).toBe(true);
  });

  it("flags SPA-shell pages and warns spa_detected when all pages are thin", async () => {
    const shell = `<!doctype html><html><head><title>App</title></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>`;
    const routes = {
      "https://example.com/robots.txt": { body: "" },
      "https://example.com/sitemap.xml": { status: 404, body: "" },
      "https://example.com/sitemap_index.xml": { status: 404, body: "" },
      "https://example.com/": { body: shell },
    };
    const { stub } = makeFetchStub(routes);
    const events = await collect(
      orchestrateScan({
        url: "https://example.com/",
        library,
        crawlOptions: { fetchImpl: stub, jitterMs: noJitter, maxPages: 5 },
      }),
    );
    const complete = events.find((e): e is ScanCompleteEvent => e.type === "complete");
    expect(complete).toBeDefined();
    const warnings = complete!.result.warnings;
    expect(warnings.some((w) => w.startsWith("spa_suspected:"))).toBe(true);
    expect(warnings).toContain("spa_detected");
  });
});