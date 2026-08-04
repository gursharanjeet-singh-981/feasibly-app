import * as cheerio from "cheerio";
import pLimit from "p-limit";
import robotsParser from "robots-parser";
import {
  SCAN_CONCURRENCY,
  SCAN_MAX_DEPTH,
  SCAN_MAX_PAGES,
  SCAN_PAGE_TIMEOUT_MS,
  SCAN_TOTAL_TIMEOUT_MS,
  SCAN_USER_AGENT,
} from "@/lib/constants";
import { parseUrl } from "./urlGuard";
import type {
  CrawlResult,
  CrawlWarning,
  CrawlerOptions,
  DiscoveredPage,
  PageType,
} from "./types";

interface QueueItem {
  url: string;
  depth: number;
  discoveredFrom: DiscoveredPage["discoveredFrom"];
}

const SITEMAP_CANDIDATES = ["/sitemap.xml", "/sitemap_index.xml"];

function classifyPage(url: URL, title: string): PageType {
  const path = url.pathname.toLowerCase();
  const t = title.toLowerCase();
  if (path === "/" || path === "") return "home";
  if (/\b(product|shop|catalog|store)s?\/[^/]+\/?$/.test(path)) return "product-detail";
  if (/\b(product|shop|catalog|category|collection)s?\/?/.test(path)) return "product-list";
  if (/\/(blog|news|article|post|insight)s?\//.test(path)) return "article";
  if (/(contact|support)/.test(path)) return "contact";
  if (/(search|find)/.test(path)) return "search";
  if (/landing|campaign|lp/.test(path)) return "landing";
  if (/\barticle\b|\bpost\b/.test(t)) return "article";
  return "other";
}

function normalizeUrl(href: string, base: URL): string | null {
  try {
    const u = new URL(href, base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    // Drop tracking params to dedupe.
    const params = u.searchParams;
    for (const key of Array.from(params.keys())) {
      if (key.startsWith("utm_") || key === "gclid" || key === "fbclid") {
        params.delete(key);
      }
    }
    return u.toString();
  } catch {
    return null;
  }
}

function sameHost(a: URL, b: URL): boolean {
  const stripWww = (h: string) => h.replace(/^www\./, "");
  return stripWww(a.hostname) === stripWww(b.hostname);
}

async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
  fetchImpl: typeof fetch,
  userAgent: string,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": userAgent,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(
  url: string,
  timeoutMs: number,
  fetchImpl: typeof fetch,
  userAgent: string,
): Promise<{ ok: true; text: string; finalUrl: string } | { ok: false; status: number; error?: string }> {
  try {
    const res = await fetchWithTimeout(url, timeoutMs, fetchImpl, userAgent);
    if (!res.ok) return { ok: false, status: res.status };
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType && !/text\/|application\/(xhtml|xml)/i.test(contentType)) {
      return { ok: false, status: 415, error: "unsupported content-type" };
    }
    const text = await res.text();
    return { ok: true, text, finalUrl: res.url || url };
  } catch (e) {
    const err = e as Error;
    return { ok: false, status: 0, error: err.name === "AbortError" ? "timeout" : err.message };
  }
}

async function loadRobots(
  baseUrl: URL,
  fetchImpl: typeof fetch,
  userAgent: string,
  timeoutMs: number,
): Promise<{ robots: ReturnType<typeof robotsParser>; sitemapUrls: string[] }> {
  const robotsUrl = new URL("/robots.txt", baseUrl).toString();
  const res = await fetchText(robotsUrl, timeoutMs, fetchImpl, userAgent);
  const body = res.ok ? res.text : "";
  const robots = robotsParser(robotsUrl, body);
  const sitemapUrls = robots.getSitemaps() ?? [];
  return { robots, sitemapUrls };
}

async function collectSitemapUrls(
  sitemapUrls: string[],
  baseUrl: URL,
  fetchImpl: typeof fetch,
  userAgent: string,
  timeoutMs: number,
  maxPages: number,
  warnings: CrawlWarning[],
): Promise<string[]> {
  const seen = new Set<string>();
  const collected: string[] = [];
  const queue = [...sitemapUrls];
  for (const candidate of SITEMAP_CANDIDATES) {
    queue.push(new URL(candidate, baseUrl).toString());
  }
  let anyFound = false;
  while (queue.length && collected.length < maxPages) {
    const sm = queue.shift()!;
    if (seen.has(sm)) continue;
    seen.add(sm);
    const res = await fetchText(sm, timeoutMs, fetchImpl, userAgent);
    if (!res.ok) continue;
    anyFound = true;
    try {
      const $ = cheerio.load(res.text, { xmlMode: true });
      // sitemap index -> more sitemaps
      $("sitemapindex > sitemap > loc").each((_, el) => {
        const loc = $(el).text().trim();
        if (loc) queue.push(loc);
      });
      $("urlset > url > loc").each((_, el) => {
        const loc = $(el).text().trim();
        const normalized = normalizeUrl(loc, baseUrl);
        if (normalized && sameHost(new URL(normalized), baseUrl) && collected.length < maxPages) {
          collected.push(normalized);
        }
      });
    } catch {
      warnings.push({ code: "invalid_html", message: `Malformed sitemap: ${sm}`, url: sm });
    }
  }
  if (!anyFound) {
    warnings.push({ code: "sitemap_missing", message: "No sitemap.xml found; falling back to BFS" });
  }
  return collected;
}

function extractLinks($: cheerio.CheerioAPI, base: URL): string[] {
  const out = new Set<string>();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const n = normalizeUrl(href, base);
    if (n) out.add(n);
  });
  return [...out];
}

function looksLikeSpa(html: string, $: cheerio.CheerioAPI): boolean {
  const bodyText = $("body").text().trim();
  const hasRoot = $("#root, #app, #__next").length > 0;
  const scriptCount = $("script").length;
  return bodyText.length < 200 && hasRoot && scriptCount > 3;
}

export async function crawlSite(
  input: string,
  options: CrawlerOptions = {},
): Promise<CrawlResult> {
  const started = Date.now();
  const parsed = parseUrl(input);
  if (!parsed.ok || !parsed.url) {
    throw new Error(parsed.reason ?? "Invalid URL");
  }
  const baseUrl = parsed.url;

  const {
    maxPages = SCAN_MAX_PAGES,
    maxDepth = SCAN_MAX_DEPTH,
    concurrency = SCAN_CONCURRENCY,
    pageTimeoutMs = SCAN_PAGE_TIMEOUT_MS,
    totalTimeoutMs = SCAN_TOTAL_TIMEOUT_MS,
    userAgent = SCAN_USER_AGENT,
    respectRobots = true,
    fetchImpl = fetch,
    onProgress,
  } = options;

  const warnings: CrawlWarning[] = [];
  const discoveredPages: DiscoveredPage[] = [];
  const pageHtml = new Map<string, string>();
  const visited = new Set<string>();
  const deadline = started + totalTimeoutMs;
  let truncated = false;

  const { robots, sitemapUrls } = respectRobots
    ? await loadRobots(baseUrl, fetchImpl, userAgent, pageTimeoutMs)
    : { robots: null, sitemapUrls: [] as string[] };

  const isAllowed = (url: string) => {
    if (!respectRobots || !robots) return true;
    const allowed = robots.isAllowed(url, userAgent);
    return allowed !== false;
  };

  onProgress?.({ stage: "sitemap", pagesScanned: 0, pagesQueued: 0 });

  const sitemapPages = await collectSitemapUrls(
    sitemapUrls,
    baseUrl,
    fetchImpl,
    userAgent,
    pageTimeoutMs,
    maxPages,
    warnings,
  );

  const seed = baseUrl.toString();
  const queue: QueueItem[] = [];
  const seedSet = new Set<string>();
  const pushQueue = (item: QueueItem) => {
    if (seedSet.has(item.url)) return;
    seedSet.add(item.url);
    queue.push(item);
  };
  pushQueue({ url: seed, depth: 0, discoveredFrom: "seed" });
  for (const u of sitemapPages) pushQueue({ url: u, depth: 0, discoveredFrom: "sitemap" });

  const limit = pLimit(concurrency);
  const inFlight = new Set<Promise<void>>();

  const processOne = async (item: QueueItem): Promise<void> => {
    if (visited.size >= maxPages) return;
    if (Date.now() > deadline) return;
    if (visited.has(item.url)) return;
    if (!isAllowed(item.url)) {
      warnings.push({ code: "robots_disallow", message: `robots.txt disallowed`, url: item.url });
      return;
    }
    visited.add(item.url);

    onProgress?.({
      stage: "crawl",
      pagesScanned: visited.size,
      pagesQueued: queue.length,
      currentUrl: item.url,
    });

    const res = await fetchText(item.url, pageTimeoutMs, fetchImpl, userAgent);
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        warnings.push({ code: "auth_required", message: `Auth required (${res.status})`, url: item.url });
      } else if (res.error === "timeout") {
        warnings.push({ code: "timeout", message: "Page fetch timeout", url: item.url });
      } else {
        warnings.push({
          code: "fetch_error",
          message: `Fetch failed (${res.status}${res.error ? `: ${res.error}` : ""})`,
          url: item.url,
        });
      }
      return;
    }

    let $: cheerio.CheerioAPI;
    try {
      $ = cheerio.load(res.text);
    } catch {
      warnings.push({ code: "invalid_html", message: "Invalid HTML", url: item.url });
      return;
    }

    if (looksLikeSpa(res.text, $)) {
      warnings.push({ code: "spa_detected", message: "Page appears to be SPA-rendered", url: item.url });
    }

    const title = ($("title").first().text() || "").trim();
    const finalUrl = new URL(res.finalUrl);
    discoveredPages.push({
      url: res.finalUrl,
      title,
      pageType: classifyPage(finalUrl, title),
      depth: item.depth,
      discoveredFrom: item.discoveredFrom,
    });
    pageHtml.set(res.finalUrl, res.text);

    if (item.depth >= maxDepth) return;
    if (visited.size >= maxPages) return;

    const links = extractLinks($, finalUrl);
    for (const link of links) {
      if (visited.size + queue.length >= maxPages) {
        truncated = true;
        break;
      }
      const linkUrl = new URL(link);
      if (!sameHost(linkUrl, baseUrl)) continue;
      pushQueue({ url: link, depth: item.depth + 1, discoveredFrom: "bfs" });
    }
  };

  const drain = async () => {
    while ((queue.length > 0 || inFlight.size > 0) && visited.size < maxPages && Date.now() <= deadline) {
      while (queue.length > 0 && inFlight.size < concurrency && visited.size < maxPages) {
        const item = queue.shift()!;
        const p = limit(() => processOne(item))
          .catch(() => {})
          .finally(() => {
            inFlight.delete(p);
          });
        inFlight.add(p);
      }
      if (inFlight.size === 0) break;
      await Promise.race(inFlight);
    }
    await Promise.allSettled(inFlight);
  };

  await drain();

  if (visited.size >= maxPages && (queue.length > 0 || truncated)) {
    warnings.push({
      code: "max_pages_reached",
      message: `Stopped at max pages (${maxPages})`,
    });
  }
  if (Date.now() > deadline) {
    warnings.push({ code: "timeout", message: "Overall scan timeout reached; returning partial results" });
  }

  return {
    baseUrl: baseUrl.toString(),
    pagesScanned: discoveredPages.length,
    discoveredPages,
    warnings,
    durationMs: Date.now() - started,
    pageHtml,
  };
}
