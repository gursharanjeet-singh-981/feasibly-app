import { z } from "zod";
import { crawl } from "@/lib/scanner/crawler";
import { UrlGuardError, assertPublicUrl } from "@/lib/scanner/urlGuard";
import { cleanHtmlForModel } from "@/lib/ai-scan/cleanHtml";
import { AI_SCAN_CONFIG, geminiConfig, groqConfig, isAiScanEnabled } from "@/lib/ai-scan/config";
import { reserveDailyAiCall } from "@/lib/ai-scan/budget";
import { AiProviderError, classifyWithProvider, isQuotaError } from "@/lib/ai-scan/provider";
import { clientIp, consumeRateLimit } from "@/lib/rateLimit";
import type { ClassifyResponse } from "@/lib/ai-scan/apiTypes";
import componentsJson from "../../../../../../public/data/components.json";
import templatesJson from "../../../../../../public/data/templates.json";
import type { Component, Template } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TRANSIENT_RETRY_MS = 2_000;

const library = {
  components: componentsJson as Component[],
  templates: templatesJson as Template[],
};
const allowedGroups = [...new Set(library.components.map((c) => c.group))];
const allowedTemplates = [...new Set(library.templates.map((t) => t.name))];

const bodySchema = z.object({
  url: z.string().min(1),
  page: z.string().min(1),
  provider: z.enum(["gemini", "groq"]),
});

/** Runs one AI call for one page. The browser decides which page and which provider. */
export async function POST(request: Request): Promise<Response> {
  if (!isAiScanEnabled()) return Response.json({ error: "ai_scan_disabled" }, { status: 503 });
  if (!consumeRateLimit(`classify:${clientIp(request)}`, 600)) {
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
  const { url, page, provider } = parsed.data;

  const configured = provider === "gemini" ? geminiConfig().apiKey : groqConfig().apiKey;
  if (!configured) return Response.json({ error: `${provider}_not_configured` }, { status: 503 });

  try {
    assertPublicUrl(url);
    assertPublicUrl(page);
  } catch (err) {
    return Response.json({ error: err instanceof UrlGuardError ? err.code : "invalid_url" }, { status: 400 });
  }
  if (new URL(page).origin !== new URL(url).origin) {
    return Response.json({ error: "cross_origin_url" }, { status: 400 });
  }

  const fetched = (await crawl(url, {
    explicitUrls: [page],
    maxPages: 1,
    maxDepth: 0,
    followLinks: false,
    maxPagesPerPathTemplate: 0,
    useSitemapRepresentatives: false,
  })).pages.find((p) => p.url === page);
  if (!fetched) return Response.json({ error: "page_fetch_failed" }, { status: 502 });
  // Never send an error or block page to the model as if it were the site's content.
  if (fetched.status < 200 || fetched.status >= 300) {
    return Response.json({ error: "page_unavailable", status: fetched.status }, { status: 502 });
  }

  const maxChars = provider === "groq" ? AI_SCAN_CONFIG.maxHtmlCharsGroq : AI_SCAN_CONFIG.maxHtmlChars;
  const html = cleanHtmlForModel(fetched.html, maxChars);

  // Server-side daily cap. Reserved before the paid call, so repeated scans cannot exceed it.
  if (!reserveDailyAiCall(provider)) {
    return Response.json({ error: "daily_cap" }, { status: 429 });
  }

  const classifyOnce = () =>
    classifyWithProvider(provider, { url: page, html }, { allowedGroups, allowedTemplates });
  try {
    let result;
    try {
      result = await classifyOnce();
    } catch (err) {
      // Transient provider errors (e.g. Gemini 503 "high demand", empty replies) often clear
      // within seconds. Retry once. Quota errors are not retried.
      if (!(err instanceof AiProviderError) || !err.retryable || isQuotaError(err)) throw err;
      await new Promise((resolve) => setTimeout(resolve, TRANSIENT_RETRY_MS));
      result = await classifyOnce();
    }
    const body: ClassifyResponse = { provider, detections: result.detections, template: result.template };
    return Response.json(body);
  } catch (err) {
    if (isQuotaError(err)) return Response.json({ error: "quota" }, { status: 429 });
    const code = err instanceof AiProviderError ? err.code : "ai_unknown_error";
    return Response.json({ error: code }, { status: 502 });
  }
}
