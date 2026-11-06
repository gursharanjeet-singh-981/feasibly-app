import { SCAN_FEATURE_ENABLED } from "@/lib/constants";
import type { Component, Template } from "@/types";
import { UrlGuardError, assertPublicUrl } from "@/lib/scanner/urlGuard";
import { orchestrateAiScan } from "@/lib/ai-scan/orchestrator";
import { hasAiProviderKey } from "@/lib/ai-scan/provider";
import { isAiScanEnabled } from "@/lib/ai-scan/config";
import componentsJson from "../../../../../public/data/components.json";
import templatesJson from "../../../../../public/data/templates.json";
import { z } from "zod";
import { checkRateLimit, sseStream } from "../full/_internals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const library = {
  components: componentsJson as Component[],
  templates: templatesJson as Template[],
};

const bodySchema = z.object({
  url: z.string().min(1),
  mode: z.enum(["single", "full"]).default("full"),
});

export async function POST(request: Request): Promise<Response> {
  if (!SCAN_FEATURE_ENABLED) return jsonError("feature_disabled", 503);
  if (!isAiScanEnabled()) return jsonError("ai_scan_disabled", 503);
  if (!hasAiProviderKey()) return jsonError("ai_not_configured", 503);

  // Separate rate-limit bucket from the regular scanner, so testing one does not block the other.
  const ip = getClientIp(request);
  if (!checkRateLimit(`ai:${ip}`)) return jsonError("rate_limited", 429);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonError("invalid_json", 400);
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return jsonError("invalid_body", 400);
  const { url, mode } = parsed.data;

  try {
    assertPublicUrl(url);
  } catch (err) {
    const code = err instanceof UrlGuardError ? err.code : "invalid_url";
    return jsonError(code, 400);
  }

  const generator = orchestrateAiScan({ url, mode, library, signal: request.signal });

  return new Response(sseStream(generator), {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

function jsonError(code: string, status: number): Response {
  return new Response(JSON.stringify({ error: code }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function getClientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
