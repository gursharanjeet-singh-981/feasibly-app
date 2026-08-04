import { describe, expect, it } from "vitest";
import { crawlSite } from "./crawler";

interface FixtureFile {
  status?: number;
  contentType?: string;
  body: string;
}

function makeFetch(files: Record<string, FixtureFile>): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const key = url.replace(/\/$/, "") || url;
    const match = files[url] ?? files[key] ?? files[key + "/"];
    if (!match) {
      return new Response("not found", { status: 404, headers: { "content-type": "text/html" } });
    }
    return new Response(match.body, {
      status: match.status ?? 200,
      headers: { "content-type": match.contentType ?? "text/html" },
    });
  }) as typeof fetch;
}

const ROBOTS_ALLOW_ALL = "User-agent: *\nAllow: /\n";
const ROBOTS_BLOCK_ADMIN = "User-agent: *\nDisallow: /admin\n";

describe("crawlSite", () => {
  it("crawls homepage and follows same-host links up to maxDepth", async () => {
    const files: Record<string, FixtureFile> = {
      "https://example.com/robots.txt": { body: ROBOTS_ALLOW_ALL, contentType: "text/plain" },
      "https://example.com/sitemap.xml": { status: 404, body: "" },
      "https://example.com/sitemap_index.xml": { status: 404, body: "" },
      "https://example.com/": {
        body: `<html><head><title>Home</title></head><body>
          <a href="/about">About</a>
          <a href="/blog/post-1">Post</a>
          <a href="https://other.com/x">External</a>
        </body></html>`,
      },
      "https://example.com/about": {
        body: `<html><head><title>About</title></head><body>Text</body></html>`,
      },
      "https://example.com/blog/post-1": {
        body: `<html><head><title>Post</title></head><body>Text</body></html>`,
      },
    };
    const result = await crawlSite("https://example.com", {
      fetchImpl: makeFetch(files),
      maxDepth: 2,
      maxPages: 10,
      concurrency: 2,
    });
    const urls = result.discoveredPages.map((p) => p.url).sort();
    expect(urls).toContain("https://example.com/");
    expect(urls).toContain("https://example.com/about");
    expect(urls).toContain("https://example.com/blog/post-1");
    expect(urls.every((u) => u.startsWith("https://example.com"))).toBe(true);
  });

  it("respects robots.txt disallow", async () => {
    const files: Record<string, FixtureFile> = {
      "https://example.com/robots.txt": { body: ROBOTS_BLOCK_ADMIN, contentType: "text/plain" },
      "https://example.com/sitemap.xml": { status: 404, body: "" },
      "https://example.com/sitemap_index.xml": { status: 404, body: "" },
      "https://example.com/": {
        body: `<html><head><title>Home</title></head><body>
          <a href="/admin/secret">Admin</a>
          <a href="/public">Public</a>
        </body></html>`,
      },
      "https://example.com/public": {
        body: `<html><head><title>Public</title></head><body>hi</body></html>`,
      },
    };
    const result = await crawlSite("https://example.com", {
      fetchImpl: makeFetch(files),
      maxDepth: 2,
    });
    const urls = result.discoveredPages.map((p) => p.url);
    expect(urls).toContain("https://example.com/public");
    expect(urls).not.toContain("https://example.com/admin/secret");
    expect(result.warnings.some((w) => w.code === "robots_disallow")).toBe(true);
  });

  it("uses sitemap.xml when available", async () => {
    const files: Record<string, FixtureFile> = {
      "https://example.com/robots.txt": { body: ROBOTS_ALLOW_ALL, contentType: "text/plain" },
      "https://example.com/sitemap.xml": {
        contentType: "application/xml",
        body: `<?xml version="1.0"?>
          <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <url><loc>https://example.com/a</loc></url>
            <url><loc>https://example.com/b</loc></url>
          </urlset>`,
      },
      "https://example.com/": { body: `<html><title>Home</title><body></body></html>` },
      "https://example.com/a": { body: `<html><title>A</title><body></body></html>` },
      "https://example.com/b": { body: `<html><title>B</title><body></body></html>` },
    };
    const result = await crawlSite("https://example.com", {
      fetchImpl: makeFetch(files),
    });
    const urls = result.discoveredPages.map((p) => p.url).sort();
    expect(urls).toEqual(
      expect.arrayContaining([
        "https://example.com/",
        "https://example.com/a",
        "https://example.com/b",
      ]),
    );
    const fromSitemap = result.discoveredPages.filter((p) => p.discoveredFrom === "sitemap");
    expect(fromSitemap.length).toBeGreaterThanOrEqual(2);
  });

  it("stops at maxPages", async () => {
    const files: Record<string, FixtureFile> = {
      "https://example.com/robots.txt": { body: ROBOTS_ALLOW_ALL, contentType: "text/plain" },
      "https://example.com/sitemap.xml": { status: 404, body: "" },
      "https://example.com/sitemap_index.xml": { status: 404, body: "" },
      "https://example.com/": {
        body: `<html><title>Home</title><body>
          <a href="/1">1</a><a href="/2">2</a><a href="/3">3</a>
        </body></html>`,
      },
      "https://example.com/1": { body: `<html><title>1</title><body></body></html>` },
      "https://example.com/2": { body: `<html><title>2</title><body></body></html>` },
      "https://example.com/3": { body: `<html><title>3</title><body></body></html>` },
    };
    const result = await crawlSite("https://example.com", {
      fetchImpl: makeFetch(files),
      maxPages: 2,
    });
    expect(result.pagesScanned).toBe(2);
    expect(result.warnings.some((w) => w.code === "max_pages_reached")).toBe(true);
  });

  it("throws on invalid URL", async () => {
    await expect(crawlSite("not a url", { fetchImpl: makeFetch({}) })).rejects.toThrow();
  });

  it("records fetch errors as warnings", async () => {
    const files: Record<string, FixtureFile> = {
      "https://example.com/robots.txt": { body: ROBOTS_ALLOW_ALL, contentType: "text/plain" },
      "https://example.com/sitemap.xml": { status: 404, body: "" },
      "https://example.com/sitemap_index.xml": { status: 404, body: "" },
      "https://example.com/": {
        body: `<html><title>Home</title><body><a href="/dead">Dead</a></body></html>`,
      },
    };
    const result = await crawlSite("https://example.com", {
      fetchImpl: makeFetch(files),
      maxDepth: 2,
    });
    expect(result.warnings.some((w) => w.code === "fetch_error")).toBe(true);
  });

  it("emits sitemap_missing warning when none found", async () => {
    const files: Record<string, FixtureFile> = {
      "https://example.com/robots.txt": { body: ROBOTS_ALLOW_ALL, contentType: "text/plain" },
      "https://example.com/sitemap.xml": { status: 404, body: "" },
      "https://example.com/sitemap_index.xml": { status: 404, body: "" },
      "https://example.com/": { body: `<html><title>H</title><body></body></html>` },
    };
    const result = await crawlSite("https://example.com", {
      fetchImpl: makeFetch(files),
    });
    expect(result.warnings.some((w) => w.code === "sitemap_missing")).toBe(true);
  });
});
