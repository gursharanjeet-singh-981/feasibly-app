import { SCAN_DEFAULTS, SCAN_FEATURE_ENABLED } from "@/lib/constants";
import type { Component, Template } from "@/types";
import { orchestrateScan } from "@/lib/scanner/orchestrator";
import { UrlGuardError, assertPublicUrl } from "@/lib/scanner/urlGuard";
import type { ScanStreamEvent } from "@/lib/scanner/types";
import componentsJson from "../../../../../public/data/components.json";
import templatesJson from "../../../../../public/data/templates.json";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const library = {
  components: componentsJson as Component[],
  templates: templatesJson as Template[],
};

const bodySchema = z.object({
  url: z.string().min(1),
});

// In-memory per-IP rate limiter. Not persistent; acceptable for MVP.
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const rateLimit = new Map<string, number[]>();

export async function POST(request: Request): Promise<Response> {
  if (!SCAN_FEATURE_ENABLED) {
    return jsonError("feature_disabled", 503);
  }

  const ip = getClientIp(request);
  if (!checkRateLimit(ip)) {
    return jsonError("rate_limited", 429);
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonError("invalid_json", 400);
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError("invalid_body", 400);
  }
  const { url } = parsed.data;

  // Synchronous SSRF gate before the orchestrator (which also re-checks with DNS).
  try {
    assertPublicUrl(url);
  } catch (err) {
    const code = err instanceof UrlGuardError ? err.code : "invalid_url";
    return jsonError(code, 400);
  }

  const generator = orchestrateScan({
    url,
    // AI enrichment is intentionally disabled; scans run on deterministic heuristics only.
    useAi: false,
    library,
    signal: request.signal,
  });

  return new Response(sseStream(generator), {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

// ---------- helpers ----------

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

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const history = (rateLimit.get(ip) ?? []).filter((t) => t > cutoff);
  if (history.length >= SCAN_DEFAULTS.rateLimitPerHour) {
    rateLimit.set(ip, history);
    return false;
  }
  history.push(now);
  rateLimit.set(ip, history);
  return true;
}

function sseStream(generator: AsyncGenerator<ScanStreamEvent>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async pull(controller) {
      try {
        const { value, done } = await generator.next();
        if (done) {
          controller.close();
          return;
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(value)}\n\n`));
        if (value.type === "complete" || value.type === "error") {
          // Drain the generator (no more events expected) and close the stream.
          controller.close();
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", message })}\n\n`,
          ),
        );
        controller.close();
      }
    },
    async cancel() {
      await generator.return?.(undefined);
    },
  });
}

// Exported for tests only.
export const __test = { checkRateLimit, rateLimit, sseStream };
