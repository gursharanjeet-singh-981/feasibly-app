import { z } from "zod";
import { discoverSitemapUrls } from "@/lib/scanner/crawler";
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

  const { urls: all, warnings } = await discoverSitemapUrls(new URL("/", parsed.data.url));
  // Sitemaps also list files that are not pages (XML, PDFs, images). They are not reviewed.
  const urls = all.filter((u) => !NON_PAGE_EXTENSIONS.test(new URL(u).pathname));
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
