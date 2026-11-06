import { describe, expect, it } from "vitest";
import { crawl } from "./crawler";

// With an explicit URL list, the crawler must fetch exactly those pages: the base URL must not
// take a slot, and it must not be fetched as a page.
describe("crawl with explicitUrls", () => {
  it("fetches only the requested pages, not the base URL", async () => {
    const fetched: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/robots.txt")) return new Response("", { status: 404 });
      fetched.push(url);
      return new Response("<html><body><p>page</p></body></html>", {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    };
    const requested = ["https://example.com/a", "https://example.com/b"];
    const result = await crawl("https://example.com/", {
      explicitUrls: requested,
      maxPages: requested.length,
      maxDepth: 0,
      followLinks: false,
      maxPagesPerPathTemplate: 0,
      useSitemapRepresentatives: false,
      fetchImpl,
      jitterMs: () => 0,
    });
    expect(fetched).not.toContain("https://example.com/");
    expect(result.pages.map((p) => p.url).sort()).toEqual([...requested].sort());
  });

  it("does not let the base URL take a slot from a requested page", async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/robots.txt")) return new Response("", { status: 404 });
      return new Response("<html><body>x</body></html>", { status: 200, headers: { "content-type": "text/html" } });
    };
    const result = await crawl("https://example.com/", {
      explicitUrls: ["https://example.com/only"],
      maxPages: 1,
      maxDepth: 0,
      followLinks: false,
      maxPagesPerPathTemplate: 0,
      useSitemapRepresentatives: false,
      fetchImpl,
      jitterMs: () => 0,
    });
    expect(result.pages.map((p) => p.url)).toEqual(["https://example.com/only"]);
  });
});
