import { describe, expect, it } from "vitest";
import { summarizeScanLimits } from "./scanWarnings";
import type { UnscannedPage } from "./types";

const unscanned = (reason: UnscannedPage["reason"], url: string): UnscannedPage => ({
  url,
  source: "link",
  reason,
});

describe("summarizeScanLimits", () => {
  it("parses AI coverage from the ai_scan warning line", () => {
    const out = summarizeScanLimits({
      warnings: ["ai_scan:mode=full;clusters=12;ai_calls=9;pages_ai_covered=140;providers=gemini:9"],
      pagesScanned: 200,
      unscannedPages: [],
    });
    expect(out.aiCoverage).toEqual({
      mode: "full",
      clusters: 12,
      aiCalls: 9,
      pagesCovered: 140,
      pagesScanned: 200,
      providers: "gemini:9",
    });
    expect(out.notices).toEqual([]);
  });

  it("explains a hit per-scan AI cap and a hit daily cap", () => {
    const out = summarizeScanLimits({
      warnings: ["ai_budget_exhausted:per_scan_cap=25", "ai_budget_exhausted:daily_cap=200"],
      pagesScanned: 50,
      unscannedPages: [],
    });
    expect(out.notices.map((n) => n.text)).toEqual([
      "AI call limit reached for this batch (25 calls). Remaining page groups in the batch use heuristics only.",
      "Daily AI limit reached (200 calls today). Remaining page groups use heuristics only.",
    ]);
  });

  it("counts AI failures once, with the error codes", () => {
    const out = summarizeScanLimits({
      warnings: [
        "ai_failed:https://x/a:gemini_http_429",
        "ai_failed:https://x/b:gemini_http_429",
        "ai_failed:https://x/c:groq_http_500",
      ],
      pagesScanned: 3,
      unscannedPages: [],
    });
    expect(out.notices).toEqual([
      { level: "warn", text: "3 AI requests failed (gemini_http_429, groq_http_500)." },
    ]);
  });

  it("reports pages skipped by the page limit from unscanned reasons", () => {
    const out = summarizeScanLimits({
      warnings: [],
      pagesScanned: 200,
      unscannedPages: [
        unscanned("max_pages_limit", "https://x/1"),
        unscanned("max_pages_limit", "https://x/2"),
        unscanned("robots_disallow", "https://x/3"),
      ],
    });
    expect(out.notices).toEqual([
      { level: "warn", text: "2 pages not scanned because the page limit was reached." },
    ]);
  });

  it("reports timeouts and login walls, and ignores unknown internal codes", () => {
    const out = summarizeScanLimits({
      warnings: ["scan_timeout_after_300000ms", "auth_wall_partial:4", "spa_suspected:https://x/"],
      pagesScanned: 10,
      unscannedPages: [],
    });
    expect(out.notices).toEqual([
      { level: "warn", text: "The scan hit its time limit, so results cover only part of the site." },
      { level: "info", text: "4 pages required a login and were skipped." },
    ]);
  });
});
