import { SCAN_DEFAULTS } from "@/lib/constants";
import type { ScanStreamEvent } from "@/lib/scanner/types";

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
export const rateLimit = new Map<string, number[]>();

export function checkRateLimit(ip: string): boolean {
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

export function sseStream(generator: AsyncGenerator<ScanStreamEvent>): ReadableStream<Uint8Array> {
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
