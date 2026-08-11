import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_USER_AGENT,
  classifyPageType,
  crawl,
  normalizeUrl,
  parseSitemap,
} from "./crawler";

type Route = {
  status?: number;
  contentType?: string;
  body: string;
};

function makeFetchStub(routes: Record<string, Route | Route[]>) {
  const calls: { url: string; headers: Headers | undefined }[] = [];
  const cursors = new Map<string, number>();
  const stub: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push({ url, headers: new Headers(init?.headers) });
    const entry = routes[url];
    if (!entry) {
      return new Response("not found", { status: 404 });
    }
    const list = Array.isArray(entry) ? entry : [entry];
    const idx = Math.min(cursors.get(url) ?? 0, list.length - 1);
    cursors.set(url, (cursors.get(url) ?? 0) + 1);
    const r = list[idx];
    return new Response(r.body, {
      status: r.status ?? 200,
      headers: { "content-type": r.contentType ?? "text/html; charset=utf-8" },
    });
  };
  return { stub, calls };
}

const page = (title: string, links: string[] = []) => {
  const anchors = links.map((h) => `<a href="${h}">x</a>`).join("");
  return `<!doctype html><html><head><title>${title}</title></head><body>${anchors}</body></html>`;
};

describe("normalizeUrl", () => {
  const base = new URL("https://example.com/");

  it("keeps same-origin, strips fragments, and normalises trailing slash", () => {
    expect(normalizeUrl("/foo", base)).toBe("https://example.com/foo");
    expect(normalizeUrl("/foo/", base)).toBe("https://example.com/foo");
    expect(normalizeUrl("/foo#bar", base)).toBe("https://example.com/foo");
  });

  it("rejects cross-origin, mailto:, javascript:", () => {
    expect(normalizeUrl("https://other.com/", base)).toBeNull();
    expect(normalizeUrl("mailto:a@b.com", base)).toBeNull();
    expect(normalizeUrl("javascript:1", base)).toBeNull();
  });
});

describe("classifyPageType", () => {
  it.each([
    ["https://x.com/", "Home"],
    ["https://x.com/index", "home"],
    ["https://x.com/privacy", "legal"],
    ["https://x.com/policies/cookies", "legal"],
    ["https://x.com/search", "search"],
    ["https://x.com/?q=hello", "search"],
    ["https://x.com/contact", "contact"],
    ["https://x.com/blog/hello-world", "article"],
    ["https://x.com/news", "article"],
    ["https://x.com/collections/summer", "listing"],
    ["https://x.com/products/12345", "product"],
    ["https://x.com/landing/promo", "landing"],
    ["https://x.com/about", "other"],
  ])("classifies %s", (input, expected) => {
    const url = new URL(input);
    const type = classifyPageType(url, "");
    expect(type).toBe(
      expected === "Home" ? "home" : expected,
    );
  });
});

describe("parseSitemap", () => {
  it("extracts <url><loc> entries from a urlset", () => {
    const xml = `<?xml version="1.0"?>
<urlset><url><loc>https://x.com/a</loc></url><url><loc>https://x.com/b</loc></url></urlset>`;
    const { urls, sitemaps } = parseSitemap(xml);
    expect(urls).toEqual(["https://x.com/a", "https://x.com/b"]);
    expect(sitemaps).toEqual([]);
  });

  it("extracts <sitemap><loc> entries from a sitemapindex", () => {
    const xml = `<?xml version="1.0"?>
<sitemapindex><sitemap><loc>https://x.com/sm1.xml</loc></sitemap></sitemapindex>`;
    const { urls, sitemaps } = parseSitemap(xml);
    expect(urls).toEqual([]);
    expect(sitemaps).toEqual(["https://x.com/sm1.xml"]);
  });
});

describe("crawl", () => {
  const noJitter = () => 0;

  it("uses sitemap URLs when present and still follows links", async () => {
    const routes: Record<string, Route> = {
      "https://x.com/robots.txt": { body: "" },
      "https://x.com/": { body: page("Home") },
      "https://x.com/sitemap.xml": {
        contentType: "application/xml",
        body: `<urlset><url><loc>https://x.com/a</loc></url><url><loc>https://x.com/b</loc></url></urlset>`,
      },
      "https://x.com/sitemap_index.xml": { status: 404, body: "" },
      "https://x.com/a": { body: page("A", ["/c"]) },
      "https://x.com/b": { body: page("B") },
      "https://x.com/c": { body: page("C") },
    };
    const { stub } = makeFetchStub(routes);
    const result = await crawl("https://x.com/", {
      fetchImpl: stub,
      jitterMs: noJitter,
    });
    expect(result.usedSitemap).toBe(true);
    expect(result.pages.map((p) => p.url).sort()).toEqual([
      "https://x.com/",
      "https://x.com/a",
      "https://x.com/b",
      "https://x.com/c",
    ]);
  });

  it("follows sitemap index recursively", async () => {
    const routes: Record<string, Route> = {
      "https://x.com/robots.txt": { body: "" },
      "https://x.com/": { body: page("Home") },
      "https://x.com/sitemap.xml": {
        contentType: "application/xml",
        body: `<sitemapindex><sitemap><loc>https://x.com/nested.xml</loc></sitemap></sitemapindex>`,
      },
      "https://x.com/sitemap_index.xml": { status: 404, body: "" },
      "https://x.com/nested.xml": {
        contentType: "application/xml",
        body: `<urlset><url><loc>https://x.com/deep</loc></url></urlset>`,
      },
      "https://x.com/deep": { body: page("Deep", ["/deeper"]) },
      "https://x.com/deeper": { body: page("Deeper") },
    };
    const { stub } = makeFetchStub(routes);
    const result = await crawl("https://x.com/", {
      fetchImpl: stub,
      jitterMs: noJitter,
    });
    expect(result.pages.map((p) => p.url).sort()).toEqual([
      "https://x.com/",
      "https://x.com/deep",
      "https://x.com/deeper",
    ]);
  });

  it("does not bias toward the last sitemap entry when maxPages limits are hit", async () => {
    const routes: Record<string, Route> = {
      "https://x.com/robots.txt": { body: "" },
      "https://x.com/": { body: page("Home") },
      "https://x.com/sitemap.xml": {
        contentType: "application/xml",
        body: `<sitemapindex>
          <sitemap><loc>https://x.com/sm-a.xml</loc></sitemap>
          <sitemap><loc>https://x.com/sm-b.xml</loc></sitemap>
        </sitemapindex>`,
      },
      "https://x.com/sitemap_index.xml": { status: 404, body: "" },
      "https://x.com/sm-a.xml": {
        contentType: "application/xml",
        body: `<urlset>
          <url><loc>https://x.com/a1</loc></url>
          <url><loc>https://x.com/a2</loc></url>
        </urlset>`,
      },
      "https://x.com/sm-b.xml": {
        contentType: "application/xml",
        body: `<urlset>
          <url><loc>https://x.com/b1</loc></url>
          <url><loc>https://x.com/b2</loc></url>
        </urlset>`,
      },
      "https://x.com/a1": { body: page("A1") },
      "https://x.com/a2": { body: page("A2") },
      "https://x.com/b1": { body: page("B1") },
      "https://x.com/b2": { body: page("B2") },
    };

    const { stub } = makeFetchStub(routes);
    const result = await crawl("https://x.com/", {
      fetchImpl: stub,
      jitterMs: noJitter,
      maxPages: 3,
    });

    const urls = result.pages.map((p) => p.url);
    expect(urls).toContain("https://x.com/a1");
    expect(urls).not.toContain("https://x.com/b2");
  });

  it("scopes crawling to a market path prefix", async () => {
    const routes: Record<string, Route> = {
      "https://x.com/robots.txt": { body: "" },
      "https://x.com/": { body: page("Home", ["/gb/about", "/cl/about"]) },
      "https://x.com/sitemap.xml": {
        contentType: "application/xml",
        body: `<urlset>
          <url><loc>https://x.com/gb/home</loc></url>
          <url><loc>https://x.com/cl/home</loc></url>
        </urlset>`,
      },
      "https://x.com/sitemap_index.xml": { status: 404, body: "" },
      "https://x.com/gb/home": { body: page("GB Home", ["/gb/about"]) },
      "https://x.com/gb/about": { body: page("GB About") },
      "https://x.com/cl/home": { body: page("CL Home", ["/cl/about"]) },
      "https://x.com/cl/about": { body: page("CL About") },
    };

    const { stub } = makeFetchStub(routes);
    const result = await crawl("https://x.com/", {
      fetchImpl: stub,
      jitterMs: noJitter,
      scopePathPrefix: "/gb",
      maxPages: 10,
    });

    expect(result.pages.map((p) => p.url).sort()).toEqual([
      "https://x.com/gb/about",
      "https://x.com/gb/home",
    ]);
    expect(result.sitemapUrls.sort()).toEqual(["https://x.com/gb/home"]);
  });

  it("emits sitemap skip warnings for links blocked by robots", async () => {
    const routes: Record<string, Route> = {
      "https://x.com/robots.txt": {
        contentType: "text/plain",
        body: "User-agent: *\nDisallow: /gb/private",
      },
      "https://x.com/": { body: page("Home") },
      "https://x.com/sitemap.xml": {
        contentType: "application/xml",
        body: `<urlset>
          <url><loc>https://x.com/gb/private</loc></url>
          <url><loc>https://x.com/gb/open</loc></url>
        </urlset>`,
      },
      "https://x.com/sitemap_index.xml": { status: 404, body: "" },
      "https://x.com/gb/open": { body: page("Open") },
    };

    const { stub } = makeFetchStub(routes);
    const result = await crawl("https://x.com/", {
      fetchImpl: stub,
      jitterMs: noJitter,
      maxPages: 1,
    });

    expect(result.warnings).toContain("sitemap_skip https://x.com/gb/private: robots_disallow");
    expect(result.warnings.some((w) => w.includes("max_pages_limit"))).toBe(false);
    expect(result.pages.map((p) => p.url)).toContain("https://x.com/gb/open");
  });

  it("falls back to BFS when no sitemap is available", async () => {
    const routes: Record<string, Route> = {
      "https://x.com/robots.txt": { body: "" },
      "https://x.com/sitemap.xml": { status: 404, body: "" },
      "https://x.com/sitemap_index.xml": { status: 404, body: "" },
      "https://x.com/": { body: page("Home", ["/a", "/b", "https://other.com/"]) },
      "https://x.com/a": { body: page("A", ["/c"]) },
      "https://x.com/b": { body: page("B") },
      "https://x.com/c": { body: page("C") },
    };
    const { stub, calls } = makeFetchStub(routes);
    const result = await crawl("https://x.com/", {
      fetchImpl: stub,
      jitterMs: noJitter,
    });
    expect(result.usedSitemap).toBe(false);
    expect(result.pages.map((p) => p.url).sort()).toEqual([
      "https://x.com/",
      "https://x.com/a",
      "https://x.com/b",
      "https://x.com/c",
    ]);
    expect(calls.some((c) => c.url === "https://other.com/")).toBe(false);
  });

  it("respects maxPages", async () => {
    const routes: Record<string, Route> = {
      "https://x.com/robots.txt": { body: "" },
      "https://x.com/sitemap.xml": { status: 404, body: "" },
      "https://x.com/sitemap_index.xml": { status: 404, body: "" },
      "https://x.com/": { body: page("Home", ["/a", "/b", "/c", "/d"]) },
      "https://x.com/a": { body: page("A") },
      "https://x.com/b": { body: page("B") },
      "https://x.com/c": { body: page("C") },
      "https://x.com/d": { body: page("D") },
    };
    const { stub } = makeFetchStub(routes);
    const result = await crawl("https://x.com/", {
      fetchImpl: stub,
      jitterMs: noJitter,
      maxPages: 3,
    });
    expect(result.pages.length).toBe(3);
  });

  it("respects maxDepth", async () => {
    const routes: Record<string, Route> = {
      "https://x.com/robots.txt": { body: "" },
      "https://x.com/sitemap.xml": { status: 404, body: "" },
      "https://x.com/sitemap_index.xml": { status: 404, body: "" },
      "https://x.com/": { body: page("Home", ["/a"]) },
      "https://x.com/a": { body: page("A", ["/b"]) },
      "https://x.com/b": { body: page("B", ["/c"]) },
      "https://x.com/c": { body: page("C") },
    };
    const { stub } = makeFetchStub(routes);
    const result = await crawl("https://x.com/", {
      fetchImpl: stub,
      jitterMs: noJitter,
      maxDepth: 1,
    });
    const urls = result.pages.map((p) => p.url).sort();
    expect(urls).toEqual(["https://x.com/", "https://x.com/a"]);
  });

  it("honours robots.txt disallow", async () => {
    const routes: Record<string, Route> = {
      "https://x.com/robots.txt": {
        contentType: "text/plain",
        body: "User-agent: *\nDisallow: /private",
      },
      "https://x.com/sitemap.xml": { status: 404, body: "" },
      "https://x.com/sitemap_index.xml": { status: 404, body: "" },
      "https://x.com/": { body: page("Home", ["/public", "/private"]) },
      "https://x.com/public": { body: page("Public") },
      "https://x.com/private": { body: page("Private") },
    };
    const { stub, calls } = makeFetchStub(routes);
    const result = await crawl("https://x.com/", {
      fetchImpl: stub,
      jitterMs: noJitter,
    });
    const urls = result.pages.map((p) => p.url);
    expect(urls).toContain("https://x.com/public");
    expect(urls).not.toContain("https://x.com/private");
    expect(calls.some((c) => c.url === "https://x.com/private")).toBe(false);
  });

  it("uses sitemap URLs listed in robots.txt", async () => {
    const routes: Record<string, Route> = {
      "https://x.com/robots.txt": {
        contentType: "text/plain",
        body: "Sitemap: https://x.com/from-robots.xml",
      },
      "https://x.com/": { body: page("Home") },
      "https://x.com/sitemap.xml": { status: 404, body: "" },
      "https://x.com/sitemap_index.xml": { status: 404, body: "" },
      "https://x.com/from-robots.xml": {
        contentType: "application/xml",
        body: `<urlset><url><loc>https://x.com/found</loc></url></urlset>`,
      },
      "https://x.com/found": { body: page("Found") },
    };
    const { stub } = makeFetchStub(routes);
    const result = await crawl("https://x.com/", {
      fetchImpl: stub,
      jitterMs: noJitter,
    });
    expect(result.pages.map((p) => p.url).sort()).toEqual([
      "https://x.com/",
      "https://x.com/found",
    ]);
  });

  it("cleans up abort listeners added during crawl jitter", async () => {
    const routes: Record<string, Route> = {
      "https://x.com/robots.txt": { body: "" },
      "https://x.com/sitemap.xml": { status: 404, body: "" },
      "https://x.com/sitemap_index.xml": { status: 404, body: "" },
      "https://x.com/": { body: page("Home", ["/a", "/b", "/c", "/d", "/e", "/f"]) },
      "https://x.com/a": { body: page("A") },
      "https://x.com/b": { body: page("B") },
      "https://x.com/c": { body: page("C") },
      "https://x.com/d": { body: page("D") },
      "https://x.com/e": { body: page("E") },
      "https://x.com/f": { body: page("F") },
    };
    const { stub } = makeFetchStub(routes);
    const ac = new AbortController();
    const addSpy = vi.spyOn(ac.signal, "addEventListener");
    const removeSpy = vi.spyOn(ac.signal, "removeEventListener");

    await crawl("https://x.com/", {
      fetchImpl: stub,
      jitterMs: () => 1,
      signal: ac.signal,
      maxPages: 7,
    });

    const addCalls = addSpy.mock.calls.filter(([eventName]) => eventName === "abort").length;
    const removeCalls = removeSpy.mock.calls.filter(([eventName]) => eventName === "abort").length;
    expect(addCalls).toBeGreaterThan(0);
    expect(removeCalls).toBe(addCalls);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it("skips non-HTML content types", async () => {
    const routes: Record<string, Route> = {
      "https://x.com/robots.txt": { body: "" },
      "https://x.com/sitemap.xml": { status: 404, body: "" },
      "https://x.com/sitemap_index.xml": { status: 404, body: "" },
      "https://x.com/": { body: page("Home", ["/file.pdf"]) },
      "https://x.com/file.pdf": {
        contentType: "application/pdf",
        body: "%PDF-1.4",
      },
    };
    const { stub } = makeFetchStub(routes);
    const result = await crawl("https://x.com/", {
      fetchImpl: stub,
      jitterMs: noJitter,
    });
    expect(result.pages.map((p) => p.url)).toEqual(["https://x.com/"]);
    expect(result.warnings.some((w) => w.includes("application/pdf"))).toBe(true);
  });

  it("sends the configured user-agent", async () => {
    const routes: Record<string, Route> = {
      "https://x.com/robots.txt": { body: "" },
      "https://x.com/sitemap.xml": { status: 404, body: "" },
      "https://x.com/sitemap_index.xml": { status: 404, body: "" },
      "https://x.com/": { body: page("Home") },
    };
    const { stub, calls } = makeFetchStub(routes);
    await crawl("https://x.com/", {
      fetchImpl: stub,
      jitterMs: noJitter,
    });
    for (const call of calls) {
      expect(call.headers?.get("user-agent")).toBe(DEFAULT_USER_AGENT);
    }
  });

  it("dedupes URLs that differ only by fragment or trailing slash", async () => {
    const routes: Record<string, Route> = {
      "https://x.com/robots.txt": { body: "" },
      "https://x.com/sitemap.xml": { status: 404, body: "" },
      "https://x.com/sitemap_index.xml": { status: 404, body: "" },
      "https://x.com/": {
        body: page("Home", ["/a", "/a/", "/a#top"]),
      },
      "https://x.com/a": { body: page("A") },
    };
    const { stub, calls } = makeFetchStub(routes);
    const result = await crawl("https://x.com/", {
      fetchImpl: stub,
      jitterMs: noJitter,
    });
    const aCalls = calls.filter((c) => c.url === "https://x.com/a").length;
    expect(aCalls).toBe(1);
    expect(result.pages.map((p) => p.url).sort()).toEqual([
      "https://x.com/",
      "https://x.com/a",
    ]);
  });
});