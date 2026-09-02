import { load } from "cheerio";
import pLimit from "p-limit";
import robotsParser from "robots-parser";
import { SCAN_DEFAULTS } from "@/lib/constants";
import type { DiscoveredPage, PageType, UnscannedPage, UnscannedPageReason } from "./types";
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
  scopePathPrefix?: string;
  userAgent?: string;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  onPage?: (page: FetchedPage) => void;
  // Deterministic jitter for tests. Real usage should leave this undefined.
  jitterMs?: () => number;
  /** Max pages allowed per shared parent-path "template" at deep URL levels. Default 1. */
  maxPagesPerPathTemplate?: number;
  /** Min URL path segments before per-template limiting applies. Default 3 (e.g. /a/b/c). */
  similarPageDepthThreshold?: number;
  /** Select sitemap route-family representatives instead of crawling every sitemap URL. */
  useSitemapRepresentatives?: boolean;
  /** Do not enqueue links found on representative pages. */
  followLinks?: boolean;
}

export interface CrawlResult {
  pages: FetchedPage[];
  discoveredCount: number;
  usedSitemap: boolean;
  sitemapUrls: string[];
  representativeUrls: string[];
  unscannedPages: UnscannedPage[];
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
    scopePathPrefix,
    userAgent = DEFAULT_USER_AGENT,
    fetchImpl = fetch,
    signal,
    onPage,
    jitterMs = () => Math.floor(Math.random() * 500),
    maxPagesPerPathTemplate = 1,
    similarPageDepthThreshold = 3,
    useSitemapRepresentatives = false,
    followLinks = true,
  } = options;

  const warnings: string[] = [];
  const seen = new Set<string>();
  const pages: FetchedPage[] = [];
  const unscannedByUrl = new Map<string, UnscannedPage>();
  const pathTemplateCount = new Map<string, number>();
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
    const scopedSitemapUrls = seedUrls.filter((url) => {
      const normalized = normalizeUrl(url, base);
      return normalized ? isWithinPathScope(normalized, scopePathPrefix) : false;
    });
    const normalizedBaseUrl = normalizeUrl(base.toString(), base)!;
    const baseIsInSitemap = scopedSitemapUrls.includes(normalizedBaseUrl);
    const sitemapSelection = useSitemapRepresentatives
      ? selectRepresentativeUrls(
        scopedSitemapUrls,
        base.toString(),
        Math.max(0, maxPages - (baseIsInSitemap ? 0 : 1)),
      )
      : { urls: scopedSitemapUrls, skipped: [] };
    const selectedSitemapUrls = sitemapSelection.urls;
    const usedSitemap = selectedSitemapUrls.length > 0;
    const representativeUrls = useSitemapRepresentatives && usedSitemap
      ? [...new Set([normalizedBaseUrl, ...selectedSitemapUrls])]
      : selectedSitemapUrls;
    const effectiveMaxPages = maxPages;
    const queue: Array<{ url: string; depth: number; source: "sitemap" | "link" }> = [];
    const sitemapSkipWarned = new Set<string>();
    const pendingSitemapUrls = new Set<string>();
    const sitemapSkipCounts = new Map<string, number>();

    const countSitemapSkip = (reason: string, count = 1) => {
      sitemapSkipCounts.set(reason, (sitemapSkipCounts.get(reason) ?? 0) + count);
    };

    const recordUnscanned = (
      url: string,
      source: "sitemap" | "link",
      reason: UnscannedPageReason,
      detail?: string,
    ) => {
      const existing = unscannedByUrl.get(url);
      if (existing?.source === "sitemap") return;
      unscannedByUrl.set(url, { url, source, reason, ...(detail ? { detail } : {}) });
    };

    const enqueue = (url: string, depth: number, source: "sitemap" | "link" = "link") => {
      const normalized = normalizeUrl(url, base);
      if (!normalized) return;
      if (!isWithinPathScope(normalized, scopePathPrefix)) return;
      if (seen.has(normalized)) return;
      if (isDisallowed(normalized)) {
        recordUnscanned(normalized, source, "robots_disallow");
        if (source === "sitemap") {
          const warning = `sitemap_skip ${normalized}: robots_disallow`;
          if (!sitemapSkipWarned.has(warning)) {
            warnings.push(warning);
            sitemapSkipWarned.add(warning);
          }
        }
        return;
      }
      if (depth > maxDepth) {
        recordUnscanned(normalized, source, "max_depth");
        return;
      }
      if (queue.length + pages.length >= effectiveMaxPages) {
        recordUnscanned(normalized, source, "max_pages_limit");
        if (source === "sitemap") {
          countSitemapSkip("max_pages_limit");
        }
        return;
      }
      if (maxPagesPerPathTemplate > 0) {
        const template = getPathTemplate(normalized);
        if (template !== null) {
          const pathParts = new URL(normalized).pathname.split("/").filter(Boolean);
          if (pathParts.length >= similarPageDepthThreshold) {
            const count = pathTemplateCount.get(template) ?? 0;
            if (count >= maxPagesPerPathTemplate) {
              seen.add(normalized);
              recordUnscanned(normalized, source, "path_template_limit");
              warnings.push(`similar_skip ${normalized}: path_template_limit`);
              return;
            }
            pathTemplateCount.set(template, count + 1);
          }
        }
      }
      seen.add(normalized);
      queue.push({ url: normalized, depth, source });
      if (source === "sitemap") {
        pendingSitemapUrls.add(normalized);
      }
    };

    for (const skipped of sitemapSelection.skipped) {
      recordUnscanned(skipped.url, "sitemap", "representative_page", skipped.detail);
    }
    enqueue(base.toString(), 0, "link");
    if (usedSitemap) {
      for (const url of selectedSitemapUrls) enqueue(url, 0, "sitemap");
    }

    // Drain the queue in waves so BFS depth is honoured while still running
    // `concurrency` fetches in parallel per wave.
    while (queue.length > 0 && pages.length < effectiveMaxPages) {
      if (signal?.aborted) {
        warnings.push("Crawl aborted");
        break;
      }
      const wave = queue.splice(
        0,
        Math.min(concurrency, queue.length, effectiveMaxPages - pages.length),
      );
      for (const item of wave) {
        pendingSitemapUrls.delete(item.url);
      }
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

      for (let index = 0; index < results.length; index++) {
        const { page, links, failure } = results[index]!;
        const item = wave[index]!;
        if (!page) {
          if (failure) {
            recordUnscanned(item.url, item.source, failure.reason, failure.detail);
          }
          continue;
        }
        pages.push(page);
        onPage?.(page);
        if (pages.length >= effectiveMaxPages) break;
        if (followLinks || !usedSitemap) {
          for (const href of links) enqueue(href, page.depth + 1, "link");
        }
      }

      if (signal?.aborted) {
        warnings.push("Crawl aborted");
        break;
      }
    }

    if (signal?.aborted) {
      const detail = abortReason(signal);
      for (const item of queue) {
        recordUnscanned(item.url, item.source, "scan_incomplete", detail);
      }
    }

    // If scan ended before all queued sitemap URLs were processed (abort/timeout),
    // emit a per-URL reason so report coverage doesn't fall back to generic text.
    if (pendingSitemapUrls.size > 0) {
      countSitemapSkip("scan_incomplete", pendingSitemapUrls.size);
    }
    for (const [reason, count] of sitemapSkipCounts) {
      warnings.push(`sitemap_skip_summary ${reason}: ${count}`);
    }

    return {
      pages,
      discoveredCount: seen.size,
      usedSitemap,
      sitemapUrls: scopedSitemapUrls,
      representativeUrls,
      unscannedPages: [...unscannedByUrl.values()],
      warnings,
    };
  } finally {
    abortRelay?.dispose();
  }
}

export interface RepresentativeUrlSelection {
  urls: string[];
  skipped: Array<{ url: string; detail: string }>;
}

export function selectRepresentativeUrls(
  sitemapUrls: string[],
  inputUrl: string,
  maxPages: number = SCAN_DEFAULTS.maxPages,
): RepresentativeUrlSelection {
  const inputLocale = localeFromUrl(inputUrl);
  const normalized = [...new Set(sitemapUrls)]
    .map((url) => {
      try {
        const parsed = new URL(url);
        parsed.hash = "";
        if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
          parsed.pathname = parsed.pathname.slice(0, -1);
        }
        return parsed.toString();
      } catch {
        return null;
      }
    })
    .filter((url): url is string => Boolean(url))
    .sort();
  const primaryLocale = inputLocale ?? normalized.map(localeFromUrl).find(Boolean);
  const representatives = new Map<string, string>();
  const skipped: Array<{ url: string; detail: string }> = [];

  const primaryLocaleUrls = normalized.filter((url) => {
    const locale = localeFromUrl(url);
    return !primaryLocale || !locale || locale === primaryLocale;
  });
  const alternateLocaleUrls = normalized.filter((url) => {
    const locale = localeFromUrl(url);
    return Boolean(primaryLocale && locale && locale !== primaryLocale);
  });

  for (const url of primaryLocaleUrls) {
    const family = routeFamily(url);
    const representative = representatives.get(family);
    if (representative) {
      skipped.push({ url, detail: `same_route_family; representative=${representative}` });
      continue;
    }
    if (representatives.size >= maxPages) {
      skipped.push({ url, detail: "representative_limit" });
      continue;
    }
    representatives.set(family, url);
  }

  for (const url of alternateLocaleUrls) {
    const equivalent = replaceLocale(url, primaryLocale!);
    const representative = representatives.get(routeFamily(equivalent)) ?? equivalent;
    skipped.push({ url, detail: `locale_duplicate; representative=${representative}` });
  }

  return { urls: [...representatives.values()], skipped };
}

function localeFromUrl(input: string): string | undefined {
  try {
    const firstSegment = new URL(input).pathname.split("/").filter(Boolean)[0];
    return firstSegment && /^[a-z]{2}(?:-[a-z]{2})?$/i.test(firstSegment)
      ? firstSegment.toLowerCase()
      : undefined;
  } catch {
    return undefined;
  }
}

function replaceLocale(input: string, locale: string): string {
  const url = new URL(input);
  const segments = url.pathname.split("/").filter(Boolean);
  segments[0] = locale;
  url.pathname = `/${segments.join("/")}`;
  return url.toString();
}

function routeFamily(input: string): string {
  const url = new URL(input);
  const segments = url.pathname.toLowerCase().split("/").filter(Boolean);
  if (segments[0] && /^[a-z]{2}(?:-[a-z]{2})?$/.test(segments[0])) segments.shift();
  const [section] = segments;
  if (section && /^(products?|pdp)$/.test(section) && segments.length >= 2) return "pdp";
  if (section && /^(categories|category|collections?|plp)$/.test(section) && segments.length >= 2) return "plp";
  if (section && /^(blog|articles?|news|posts?|stories|insights)$/.test(section) && segments.length >= 2) return "article";
  return `page:${url.pathname.toLowerCase()}`;
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
  const queue = [...candidates];

  while (queue.length > 0 && visited.size < 20) {
    if (signal?.aborted) break;
    const next = queue.shift();
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
      for (const s of sitemaps) if (!visited.has(s)) queue.push(s);
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
): Promise<{
  page: FetchedPage | null;
  links: string[];
  failure?: { reason: UnscannedPageReason; detail?: string };
}> {
  const jitter = deps.jitterMs();
  if (jitter > 0) await sleep(jitter, deps.signal);
  if (deps.signal?.aborted) {
    return {
      page: null,
      links: [],
      failure: { reason: "scan_incomplete", detail: abortReason(deps.signal) },
    };
  }

  try {
    assertPublicUrl(item.url);
  } catch (err) {
    if (err instanceof UrlGuardError) {
      deps.warnings.push(`skipped ${item.url}: ${err.code}`);
      return {
        page: null,
        links: [],
        failure: { reason: "fetch_failed", detail: err.code },
      };
    }
    throw err;
  }

  try {
    const { response: res, html } = await timedFetch(
      item.url,
      {
        fetchImpl: deps.fetchImpl,
        userAgent: deps.userAgent,
        timeoutMs: deps.perPageTimeoutMs,
        signal: deps.signal,
        abortRelay: deps.abortRelay,
      },
      async (response) => ({
        response,
        html: response.headers.get("content-type")?.includes("text/html")
          ? await response.text()
          : null,
      }),
    );
    const contentType = res.headers.get("content-type") ?? "";
    if (html === null) {
      deps.warnings.push(`skipped ${item.url}: content-type ${contentType || "unknown"}`);
      return {
        page: null,
        links: [],
        failure: { reason: "unsupported_content", detail: contentType || "unknown" },
      };
    }
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
    const detail = err instanceof Error ? err.message : String(err);
    deps.warnings.push(`fetch ${item.url} failed: ${detail}`);
    return {
      page: null,
      links: [],
      failure: {
        reason: deps.signal?.aborted ? "scan_incomplete" : "fetch_failed",
        detail,
      },
    };
  }
}

function abortReason(signal: AbortSignal): string | undefined {
  const reason = signal.reason;
  if (reason instanceof Error) return reason.message;
  return typeof reason === "string" ? reason : undefined;
}

interface TimedFetchOpts {
  fetchImpl: typeof fetch;
  userAgent: string;
  timeoutMs: number;
  signal: AbortSignal | undefined;
  abortRelay: AbortRelay | undefined;
}

async function timedFetch<T = Response>(
  url: string,
  opts: TimedFetchOpts,
  consume: (response: Response) => Promise<T> = async (response) => response as T,
): Promise<T> {
  const controller = new AbortController();
  let requestTimedOut = false;
  const timeout = setTimeout(() => {
    requestTimedOut = true;
    controller.abort();
  }, opts.timeoutMs);
  const unlinkAbortRelay = opts.abortRelay?.track(controller);
  if (!opts.abortRelay && opts.signal?.aborted) {
    controller.abort();
  }
  try {
    const response = await opts.fetchImpl(url, {
      headers: { "user-agent": opts.userAgent, accept: "text/html,application/xhtml+xml,application/xml" },
      redirect: "follow",
      signal: controller.signal,
    });
    return await consume(response);
  } catch (err) {
    if (requestTimedOut) {
      throw new Error(`request_timeout_after_${opts.timeoutMs}ms`);
    }
    if (opts.signal?.aborted) {
      const reason = opts.signal.reason;
      if (reason instanceof Error && reason.message) throw reason;
      throw new Error("scan_cancelled");
    }
    throw err;
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
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    let settled = false;
    const cleanup = () => {
      signal?.removeEventListener("abort", onAbort);
    };
    const onTimeout = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const onAbort = () => {
      if (settled) return;
      settled = true;
      clearTimeout(t);
      cleanup();
      resolve();
    };
    const t = setTimeout(onTimeout, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function isSameOrigin(candidate: string, base: URL): boolean {
  try {
    return new URL(candidate).origin === base.origin;
  } catch {
    return false;
  }
}

function isWithinPathScope(url: string, scopePathPrefix?: string): boolean {
  if (!scopePathPrefix) return true;
  try {
    const pathname = new URL(url).pathname;
    return pathname === scopePathPrefix || pathname.startsWith(`${scopePathPrefix}/`);
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
  const editorialPath = path.match(/^\/(blog|article|articles|news|post|posts|stories|insights)(?:\/(.+))?\/?$/);
  if (editorialPath) {
    return editorialPath[2] ? "article" : "listing";
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

/**
 * Returns the parent-path "template" key for a URL, or null if the URL has no
 * meaningful parent (root or single-segment paths). Used to group sibling pages
 * that share the same directory and are likely the same template.
 */
export function getPathTemplate(url: string): string | null {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    return "/" + parts.slice(0, -1).join("/");
  } catch {
    return null;
  }
}