import { z } from "zod";
import { crawl } from "@/lib/scanner/crawler";
import { analyzePage } from "@/lib/scanner/analyzer";
import { UrlGuardError, assertPublicUrl } from "@/lib/scanner/urlGuard";
import { isAiScanEnabled, AI_SCAN_CONFIG } from "@/lib/ai-scan/config";
import { clientIp, consumeRateLimit } from "@/lib/rateLimit";
import type { CrawlResponse } from "@/lib/ai-scan/apiTypes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  url: z.string().min(1),
  urls: z.array(z.string().min(1)).min(1).max(AI_SCAN_CONFIG.crawlChunkSize),
});

/** Fetches one chunk of pages and returns their heuristic analysis (no HTML). */
export async function POST(request: Request): Promise<Response> {
  if (!isAiScanEnabled()) return Response.json({ error: "ai_scan_disabled" }, { status: 503 });
  if (!consumeRateLimit(`crawl:${clientIp(request)}`, 2_000)) {
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

  const { url, urls } = parsed.data;
  try {
    assertPublicUrl(url);
    for (const u of urls) assertPublicUrl(u);
  } catch (err) {
    return Response.json({ error: err instanceof UrlGuardError ? err.code : "invalid_url" }, { status: 400 });
  }
  const origin = new URL(url).origin;
  if (urls.some((u) => new URL(u).origin !== origin)) {
    return Response.json({ error: "cross_origin_url" }, { status: 400 });
  }

  const result = await crawl(url, {
    explicitUrls: urls,
    maxPages: urls.length,
    maxDepth: 0,
    followLinks: false,
    maxPagesPerPathTemplate: 0,
    useSitemapRepresentatives: false,
    concurrency: 4,
  });

  const body: CrawlResponse = {
    pages: result.pages.map((p) => {
      const analysis = analyzePage({ url: p.url, html: p.html, pageType: p.pageType });
      return {
        url: p.url,
        title: p.title,
        pageType: p.pageType,
        depth: p.depth,
        status: p.status,
        detectedComponents: analysis.detectedComponents,
        detectedTemplate: analysis.detectedTemplate,
      };
    }),
    unscannedPages: result.unscannedPages,
    warnings: result.warnings,
  };
  return Response.json(body);
}
