import { load } from "cheerio";
import pLimit from "p-limit";
import robotsParser from "robots-parser";
import { SCAN_DEFAULTS } from "@/lib/constants";
import type { DiscoveredPage, PageType } from "./types";
import { UrlGuardError, assertPublicUrl } from "./urlGuard";

export const DEFAULT_USER_AGENT =
  "FeasiblyScanBot/0.1 (+https://feasibly.app; contact=hello@feasibly.app)";

export interface FetchedPage extends DiscoveredPage {
  html: string;
}

export interface CrawlOptions {
  maxPages?: number;
  maxDepth?: number;
  concurrency?: number;
  perPageTimeoutMs?: number;
  userAgent?: string;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  onPage?: (page: FetchedPage) => void;
  // Deterministic jitter for tests. Real usage should leave this undefined.
  jitterMs?: () => number;
}

export interface CrawlResult {
  pages: FetchedPage[];
  discoveredCount: number;
  usedSitemap: boolean;
  warnings: string[];
}

export async function crawl(
  baseInput: string | URL,
  options: CrawlOptions = {},
): Promise<CrawlResult> {
  const base = baseInput instanceof URL ? baseInput : assertPublicUrl(baseInput);
  const {
    maxPages = SCAN_DEFAULTS.maxPages,
    maxDepth = SCAN_DEFAULTS.maxDepth,
    concurrency = SCAN_DEFAULTS.crawlerConcurrency,
    perPageTimeoutMs = SCAN_DEFAULTS.perPageTimeoutMs,
    userAgent = DEFAULT_USER_AGENT,
    fetchImpl = fetch,
    signal,
    onPage,
    jitterMs = () => Math.floor(Math.random() * 500),
  } = options;

  const warnings: string[] = [];
  const seen = new Set<string>();
  const pages: FetchedPage[] = [];
  const abortRelay = createAbortRelay(signal);

  const robots = await loadRobots(base, fetchImpl, userAgent, warnings, signal, abortRelay);
  const isDisallowed = (url: string) =>
    robots?.isDisallowed(url, userAgent) === true;

  const seedUrls = await collectSitemapUrls(
    base,
    robots?.getSitemaps() ?? [],
    fetchImpl,
    userAgent,
    perPageTimeoutMs,
    warnings,
    signal,
    abortRelay,
  );
  try {
    const limit = pLimit(concurrency);
    const usedSitemap = seedUrls.length > 0;
    const queue: Array<{ url: string; depth: number }> = [];

    const enqueue = (url: string, depth: number) => {
      const normalized = normalizeUrl(url, base);
      if (!normalized) return;
      if (seen.has(normalized)) return;
      if (isDisallowed(normalized)) return;
      if (depth > maxDepth) return;
      if (queue.length + pages.length >= maxPages) return;
      seen.add(normalized);
      queue.push({ url: normalized, depth });
    };

    if (usedSitemap) {
      for (const url of seedUrls) enqueue(url, 0);
    } else {
      enqueue(base.toString(), 0);
    }

    // Drain the queue in waves so BFS depth is honoured while still running
    // `concurrency` fetches in parallel per wave.
    while (queue.length > 0 && pages.length < maxPages) {
      if (signal?.aborted) {
        warnings.push("Crawl aborted");
        break;
      }
      const wave = queue.splice(0, Math.min(queue.length, maxPages - pages.length));
      const results = await Promise.all(
        wave.map((item) =>
          limit(() =>
            fetchPage(item, {
              fetchImpl,
              userAgent,
              perPageTimeoutMs,
              jitterMs,
              signal,
              warnings,
              abortRelay,
            }),
          ),
        ),
      );

      for (const { page, links } of results) {
        if (!page) continue;
        pages.push(page);
        onPage?.(page);
        if (pages.length >= maxPages) break;
        if (usedSitemap) continue; // BFS only when we don't have a sitemap
        for (const href of links) enqueue(href, page.depth + 1);
      }
    }

    return {
      pages,
      discoveredCount: seen.size,
      usedSitemap,
      warnings,
    };
  } finally {
    abortRelay?.dispose();
  }
}

// ---------- internals ----------

async function loadRobots(
  base: URL,
  fetchImpl: typeof fetch,
  userAgent: string,
  warnings: string[],
  signal: AbortSignal | undefined,
  abortRelay: AbortRelay | undefined,
) {
  const robotsUrl = new URL("/robots.txt", base).toString();
  try {
    const res = await timedFetch(robotsUrl, {
      fetchImpl,
      userAgent,
      timeoutMs: 5_000,
      signal,
      abortRelay,
    });
    if (!res.ok) return null;
    const text = await res.text();
    return robotsParser(robotsUrl, text);
  } catch (err) {
    warnings.push(`robots.txt fetch failed: ${(err as Error).message}`);
    return null;
  }
}

async function collectSitemapUrls(
  base: URL,
  robotsSitemaps: string[],
  fetchImpl: typeof fetch,
  userAgent: string,
  perPageTimeoutMs: number,
  warnings: string[],
  signal: AbortSignal | undefined,
  abortRelay: AbortRelay | undefined,
): Promise<string[]> {
  const candidates = new Set<string>([
    ...robotsSitemaps,
    new URL("/sitemap.xml", base).toString(),
    new URL("/sitemap_index.xml", base).toString(),
  ]);

  const collected = new Set<string>();
  const visited = new Set<string>();
  const stack = [...candidates];

  while (stack.length > 0 && visited.size < 20) {
    const next = stack.pop();
    if (!next || visited.has(next)) continue;
    visited.add(next);

    try {
      assertPublicUrl(next);
    } catch {
      continue;
    }
    if (!isSameOrigin(next, base)) continue;

    try {
      const res = await timedFetch(next, {
        fetchImpl,
        userAgent,
        timeoutMs: perPageTimeoutMs,
        signal,
        abortRelay,
      });
      if (!res.ok) continue;
      const xml = await res.text();
      const { urls, sitemaps } = parseSitemap(xml);
      for (const u of urls) collected.add(u);
      for (const s of sitemaps) if (!visited.has(s)) stack.push(s);
    } catch (err) {
      warnings.push(`sitemap ${next} failed: ${(err as Error).message}`);
    }
  }

  return [...collected].filter((u) => isSameOrigin(u, base));
}

export function parseSitemap(xml: string): {
  urls: string[];
  sitemaps: string[];
} {
  const $ = load(xml, { xmlMode: true });
  const urls: string[] = [];
  const sitemaps: string[] = [];
  $("urlset > url > loc").each((_, el) => {
    const t = $(el).text().trim();
    if (t) urls.push(t);
  });
  $("sitemapindex > sitemap > loc").each((_, el) => {
    const t = $(el).text().trim();
    if (t) sitemaps.push(t);
  });
  return { urls, sitemaps };
}

interface FetchPageDeps {
  fetchImpl: typeof fetch;
  userAgent: string;
  perPageTimeoutMs: number;
  jitterMs: () => number;
  signal: AbortSignal | undefined;
  warnings: string[];
  abortRelay: AbortRelay | undefined;
}

async function fetchPage(
  item: { url: string; depth: number },
  deps: FetchPageDeps,
): Promise<{ page: FetchedPage | null; links: string[] }> {
  const jitter = deps.jitterMs();
  if (jitter > 0) await sleep(jitter, deps.signal);
  if (deps.signal?.aborted) return { page: null, links: [] };

  try {
    assertPublicUrl(item.url);
  } catch (err) {
    if (err instanceof UrlGuardError) {
      deps.warnings.push(`skipped ${item.url}: ${err.code}`);
      return { page: null, links: [] };
    }
    throw err;
  }

  try {
    const res = await timedFetch(item.url, {
      fetchImpl: deps.fetchImpl,
      userAgent: deps.userAgent,
      timeoutMs: deps.perPageTimeoutMs,
      signal: deps.signal,
      abortRelay: deps.abortRelay,
    });
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      deps.warnings.push(`skipped ${item.url}: content-type ${contentType || "unknown"}`);
      return { page: null, links: [] };
    }
    const html = await res.text();
    const $ = load(html);
    const title = ($("title").first().text() || "").trim();
    const urlObj = new URL(item.url);
    const pageType = classifyPageType(urlObj, title);

    const links: string[] = [];
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      if (href) links.push(href);
    });

    const page: FetchedPage = {
      url: item.url,
      title,
      pageType,
      depth: item.depth,
      status: res.status,
      html,
    };
    return { page, links };
  } catch (err) {
    deps.warnings.push(`fetch ${item.url} failed: ${(err as Error).message}`);
    return { page: null, links: [] };
  }
}

interface TimedFetchOpts {
  fetchImpl: typeof fetch;
  userAgent: string;
  timeoutMs: number;
  signal: AbortSignal | undefined;
  abortRelay: AbortRelay | undefined;
}

async function timedFetch(url: string, opts: TimedFetchOpts): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs);
  const unlinkAbortRelay = opts.abortRelay?.track(controller);
  if (!opts.abortRelay && opts.signal?.aborted) {
    controller.abort();
  }
  try {
    return await opts.fetchImpl(url, {
      headers: { "user-agent": opts.userAgent, accept: "text/html,application/xhtml+xml,application/xml" },
      redirect: "follow",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
    unlinkAbortRelay?.();
  }
}

interface AbortRelay {
  track: (controller: AbortController) => () => void;
  dispose: () => void;
}

function createAbortRelay(signal?: AbortSignal): AbortRelay | undefined {
  if (!signal) return undefined;

  const controllers = new Set<AbortController>();
  const onAbort = () => {
    for (const controller of controllers) {
      controller.abort();
    }
    controllers.clear();
  };

  signal.addEventListener("abort", onAbort, { once: true });

  return {
    track(controller: AbortController) {
      if (signal.aborted) {
        controller.abort();
        return () => {};
      }
      controllers.add(controller);
      return () => {
        controllers.delete(controller);
      };
    },
    dispose() {
      signal.removeEventListener("abort", onAbort);
      controllers.clear();
    },
  };
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return resolve();
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new Error("aborted"));
    });
  });
}

function isSameOrigin(candidate: string, base: URL): boolean {
  try {
    return new URL(candidate).origin === base.origin;
  } catch {
    return false;
  }
}

export function normalizeUrl(input: string, base: URL): string | null {
  try {
    const u = new URL(input, base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (u.origin !== base.origin) return null;
    u.hash = "";
    // Collapse trailing slash except for root so /foo and /foo/ dedupe.
    if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
      u.pathname = u.pathname.slice(0, -1);
    }
    return u.toString();
  } catch {
    return null;
  }
}

export function classifyPageType(url: URL, title: string): PageType {
  const path = url.pathname.toLowerCase();
  const t = title.toLowerCase();

  if (/\/search(\/|$)/.test(path) || url.searchParams.has("q") || url.searchParams.has("query")) {
    return "search";
  }
  if (path === "/" || path === "" || path === "/index" || path === "/home") {
    return "home";
  }
  if (/\/(privacy|terms|legal|cookie|cookies|gdpr|policy|policies|disclaimer|accessibility)(\/|$)/.test(path)) {
    return "legal";
  }
  if (/\/contact(\/|$)/.test(path) || /\bcontact\b/.test(t)) {
    return "contact";
  }
  if (/\/(blog|article|articles|news|post|posts|stories|insights)(\/|$)/.test(path)) {
    return "article";
  }
  if (/\/(category|categories|collection|collections|catalog|shop|store)(\/|$)/.test(path) || /\bplp\b/.test(path)) {
    return "listing";
  }
  if (/\/(products?|item|sku|pdp)(\/|$)/.test(path)) {
    return "product";
  }
  if (/\/(landing|lp|campaign|campaigns|promo)(\/|$)/.test(path)) {
    return "landing";
  }
  return "other";
}