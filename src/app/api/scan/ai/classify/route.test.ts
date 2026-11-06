import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/scanner/crawler", () => ({ crawl: vi.fn() }));
vi.mock("@/lib/ai-scan/provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai-scan/provider")>();
  return { ...actual, classifyWithProvider: vi.fn() };
});

import { crawl } from "@/lib/scanner/crawler";
import { classifyWithProvider } from "@/lib/ai-scan/provider";
import { AI_SCAN_CONFIG } from "@/lib/ai-scan/config";
import { reserveDailyAiCall, resetDailyAiBudget } from "@/lib/ai-scan/budget";
import { POST } from "./route";

const BASE = "https://example.com/";
const PAGE = "https://example.com/requested";

function request(body: unknown): Request {
  return new Request("http://localhost/api/scan/ai/classify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.stubEnv("AI_SCAN_ENABLED", "true");
  vi.stubEnv("GEMINI_API_KEY", "test-key");
  resetDailyAiBudget();
  vi.mocked(classifyWithProvider).mockReset();
  vi.mocked(crawl).mockReset();
});

describe("classify route", () => {
  it("classifies the requested page, not whichever page the crawl returned first", async () => {
    vi.mocked(crawl).mockResolvedValue({
      pages: [
        { url: BASE, title: "", pageType: "home", depth: 0, status: 200, html: "<body>BASE-PAGE</body>" },
        { url: PAGE, title: "", pageType: "other", depth: 0, status: 200, html: "<body>REQUESTED-PAGE</body>" },
      ],
      unscannedPages: [],
      warnings: [],
    } as never);
    vi.mocked(classifyWithProvider).mockResolvedValue({ detections: [], template: null });

    const res = await POST(request({ url: BASE, page: PAGE, provider: "gemini" }));
    expect(res.status).toBe(200);
    const sent = vi.mocked(classifyWithProvider).mock.calls[0]![1];
    expect(sent.html).toContain("REQUESTED-PAGE");
    expect(sent.html).not.toContain("BASE-PAGE");
  });

  it("returns daily_cap once the server-side daily budget for the provider is used up", async () => {
    vi.mocked(crawl).mockResolvedValue({
      pages: [{ url: PAGE, title: "", pageType: "other", depth: 0, status: 200, html: "<body>x</body>" }],
      unscannedPages: [],
      warnings: [],
    } as never);
    for (let i = 0; i < AI_SCAN_CONFIG.dailyAiCallCaps.gemini; i++) reserveDailyAiCall("gemini");
    const res = await POST(request({ url: BASE, page: PAGE, provider: "gemini" }));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "daily_cap" });
    expect(classifyWithProvider).not.toHaveBeenCalled();
  });
});
