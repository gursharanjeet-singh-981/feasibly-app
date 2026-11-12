import { z } from "zod";
import { discoverLinkUrls, discoverSitemapUrls } from "@/lib/scanner/crawler";
import { UrlGuardError, assertPublicUrl } from "@/lib/scanner/urlGuard";
import { isAiScanEnabled, providerLimits } from "@/lib/ai-scan/config";
import { configuredProviders } from "@/lib/ai-scan/provider";
import { clientIp, consumeRateLimit } from "@/lib/rateLimit";
import type { DiscoverResponse } from "@/lib/ai-scan/apiTypes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({ url: z.string().min(1) });
const NON_PAGE_EXTENSIONS = /\.(xml|pdf|jpe?g|png|gif|svg|webp|zip|docx?|xlsx?|pptx?|mp4|mp3)$/i;
// Redirect and interstitial pages (e.g. Disney's /exit-interstitial/ links) carry no content to review.
const NON_PAGE_PATHS = /^\/exit-interstitial\//i;
const isPageUrl = (u: string) => {
  const { pathname } = new URL(u);
  return !NON_PAGE_EXTENSIONS.test(pathname) && !NON_PAGE_PATHS.test(pathname);
};

/** Lists the site's page URLs from its sitemaps. Stateless: the browser keeps the list. */
export async function POST(request: Request): Promise<Response> {
  if (!isAiScanEnabled()) return Response.json({ error: "ai_scan_disabled" }, { status: 503 });
  const providers = configuredProviders();
  if (providers.length === 0) return Response.json({ error: "ai_not_configured" }, { status: 503 });
  if (!consumeRateLimit(`discover:${clientIp(request)}`, 60)) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return Response.json({ error: "invalid_body" }, { status: 400 });

  try {
    assertPublicUrl(parsed.data.url);
  } catch (err) {
    return Response.json({ error: err instanceof UrlGuardError ? err.code : "invalid_url" }, { status: 400 });
  }

  const base = new URL("/", parsed.data.url);
  const sitemap = await discoverSitemapUrls(base);
  const warnings = [...sitemap.warnings];
  // Sitemaps also list files that are not pages (XML, PDFs, images). They are not reviewed.
  let urls = sitemap.urls.filter(isPageUrl);
  // Many sites have no sitemap, or one that lists only the homepage. Follow the homepage's links instead.
  if (urls.length <= 1) {
    const links = await discoverLinkUrls(base);
    warnings.push(`sitemap_insufficient:links_found=${links.urls.length}`, ...links.warnings);
    urls = [...new Set([...urls, ...links.urls.filter(isPageUrl)])];
  }
  const limits = providerLimits();
  const body: DiscoverResponse = {
    urls,
    warnings,
    providers,
    limits: {
      gemini: { minIntervalMs: limits.gemini.minIntervalMs, dailyCallCap: limits.gemini.dailyCallCap },
      groq: { minIntervalMs: limits.groq.minIntervalMs, dailyCallCap: limits.groq.dailyCallCap },
    },
  };
  return Response.json(body);
}
