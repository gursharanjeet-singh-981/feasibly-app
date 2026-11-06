import type { UnscannedPage } from "./types";

export interface AiCoverage {
  mode: string;
  clusters: number;
  aiCalls: number;
  pagesCovered: number;
  pagesScanned: number;
  providers: string;
}

export interface ScanNotice {
  level: "info" | "warn";
  text: string;
}

export interface ScanLimitSummary {
  aiCoverage: AiCoverage | null;
  notices: ScanNotice[];
}

/**
 * Turns raw scan warning codes and unscanned-page reasons into plain-language notices.
 * Unknown codes are ignored here, so the banner never shows internal strings.
 */
export function summarizeScanLimits(input: {
  warnings: string[];
  pagesScanned: number;
  unscannedPages: UnscannedPage[];
}): ScanLimitSummary {
  const notices: ScanNotice[] = [];
  let aiCoverage: AiCoverage | null = null;

  for (const w of input.warnings) {
    if (w.startsWith("ai_scan:")) {
      const fields = Object.fromEntries(
        w
          .slice("ai_scan:".length)
          .split(";")
          .map((kv) => kv.split("=") as [string, string]),
      );
      aiCoverage = {
        mode: fields.mode ?? "",
        clusters: Number(fields.clusters ?? 0),
        aiCalls: Number(fields.ai_calls ?? 0),
        pagesCovered: Number(fields.pages_ai_covered ?? 0),
        pagesScanned: input.pagesScanned,
        providers: fields.providers ?? "none",
      };
    } else if (w.startsWith("ai_budget_exhausted:per_scan_cap=")) {
      const cap = w.split("=")[1];
      notices.push({
        level: "warn",
        text: `AI call limit reached for this batch (${cap} calls). Remaining page groups in the batch use heuristics only.`,
      });
    } else if (w.startsWith("ai_budget_exhausted:daily_cap=")) {
      const cap = w.split("=")[1];
      notices.push({
        level: "warn",
        text: `Daily AI limit reached (${cap} calls today). Remaining page groups use heuristics only.`,
      });
    } else if (w.startsWith("ai_clusters_without_result:")) {
      const n = Number(w.split(":")[1]);
      notices.push({
        level: "warn",
        text: `${n} page group${n === 1 ? "" : "s"} received no AI review. Their results are heuristic-only.`,
      });
    } else if (w.startsWith("ai_provider_switched:")) {
      const [from, to] = w.slice("ai_provider_switched:".length).split("->");
      notices.push({ level: "info", text: `AI switched from ${providerLabel(from)} to ${providerLabel(to)} after a quota limit.` });
    } else if (w.startsWith("ai_quota_reached:")) {
      notices.push({ level: "warn", text: `${providerLabel(w.split(":")[1])} quota reached for today.` });
    } else if (w.startsWith("ai_failed:")) {
      // Counted once below, so individual failures do not flood the banner.
    } else if (w.startsWith("scan_timeout_after_")) {
      notices.push({
        level: "warn",
        text: "The scan hit its time limit, so results cover only part of the site.",
      });
    } else if (w.startsWith("auth_wall_partial:")) {
      const n = w.split(":")[1];
      notices.push({
        level: "info",
        text: `${n} page${n === "1" ? "" : "s"} required a login and were skipped.`,
      });
    }
  }

  const failed = input.warnings.filter((w) => w.startsWith("ai_failed:"));
  if (failed.length > 0) {
    const codes = [...new Set(failed.map((w) => w.split(":").at(-1) ?? "unknown"))];
    notices.push({
      level: "warn",
      text: `${failed.length} AI request${failed.length === 1 ? "" : "s"} failed (${codes.join(", ")}).`,
    });
  }

  const pageLimitHits = input.unscannedPages.filter((p) => p.reason === "max_pages_limit").length;
  if (pageLimitHits > 0) {
    notices.push({
      level: "warn",
      text: `${pageLimitHits} page${pageLimitHits === 1 ? "" : "s"} not scanned because the page limit was reached.`,
    });
  }

  return { aiCoverage, notices };
}

function providerLabel(provider: string | undefined): string {
  if (provider === "gemini") return "Gemini";
  if (provider === "groq") return "Groq";
  return provider ?? "the provider";
}
