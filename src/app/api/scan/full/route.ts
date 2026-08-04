import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { SCAN_FEATURE_ENABLED } from "@/lib/constants";
import { runScan } from "@/lib/scanner/orchestrator";
import type { Component, Template } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

const BodySchema = z.object({
  url: z.string().min(1).max(2048),
});

async function loadLibrary(): Promise<{ components: Component[]; templates: Template[] }> {
  const dir = path.join(process.cwd(), "public", "data");
  const [componentsRaw, templatesRaw] = await Promise.all([
    readFile(path.join(dir, "components.json"), "utf8"),
    readFile(path.join(dir, "templates.json"), "utf8"),
  ]);
  return {
    components: JSON.parse(componentsRaw) as Component[],
    templates: JSON.parse(templatesRaw) as Template[],
  };
}

function encodeEvent(payload: unknown): Uint8Array {
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  return new TextEncoder().encode(data);
}

export async function POST(request: Request) {
  if (!SCAN_FEATURE_ENABLED) {
    return Response.json({ error: "Scan feature disabled" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, { status: 400 });
  }

  const library = await loadLibrary();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const abort = () => {
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
      request.signal.addEventListener("abort", abort);

      try {
        for await (const event of runScan(parsed.data.url, {
          components: library.components,
          templates: library.templates,
        })) {
          if (request.signal.aborted) break;
          controller.enqueue(encodeEvent(event));
        }
      } catch (e) {
        const err = e as Error;
        controller.enqueue(encodeEvent({ type: "error", message: err.message }));
      } finally {
        request.signal.removeEventListener("abort", abort);
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
