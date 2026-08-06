import { load } from "cheerio";
import { COMPONENT_RULES, TEMPLATE_MAP, type DetectionRule } from "./constants";
import type {
  DetectedComponent,
  DetectedTemplate,
  PageAnalysis,
  PageType,
} from "./types";

export interface AnalyzeInput {
  url: string;
  html: string;
  pageType: PageType;
  rules?: DetectionRule[];
}

export function analyzePage(input: AnalyzeInput): PageAnalysis {
  const { url, html, pageType, rules = COMPONENT_RULES } = input;
  const $ = load(html);

  // Aggregate per groupName so multiple rules for the same group collapse
  // into a single DetectedComponent with max confidence.
  const byGroup = new Map<string, DetectedComponent>();

  for (const rule of rules) {
    let count = 0;
    try {
      count = $(rule.selector).length;
    } catch {
      continue; // Malformed selector — skip rather than crashing the page.
    }
    if (count < rule.minCount) continue;

    const existing = byGroup.get(rule.groupName);
    if (!existing || rule.confidence > existing.confidence) {
      byGroup.set(rule.groupName, {
        groupName: rule.groupName,
        confidence: rule.confidence,
        source: "heuristic",
        evidence: rule.evidence,
      });
    }
  }

  const detectedComponents = [...byGroup.values()].sort(
    (a, b) => b.confidence - a.confidence,
  );

  const detectedTemplate = detectTemplate($, pageType, detectedComponents);

  return { url, pageType, detectedComponents, detectedTemplate };
}

function detectTemplate(
  $: ReturnType<typeof load>,
  pageType: PageType,
  detected: DetectedComponent[],
): DetectedTemplate | null {
  const base = TEMPLATE_MAP[pageType];
  if (!base) return null;

  let confidence = base.confidence;
  const groups = new Set(detected.map((d) => d.groupName));

  // Boost when DOM markers agree with the URL-derived pageType.
  if (base.name === "PDP" && groups.has("Product (PDP)")) confidence = Math.max(confidence, 0.95);
  if (
    base.name === "Listing Page (ie: PLP, Blog landing)" &&
    (groups.has("Product List (PLP)") || groups.has("Product Teaser"))
  ) {
    confidence = Math.max(confidence, 0.9);
  }
  if (base.name === "Search Results Page" && groups.has("Search Lister")) {
    confidence = Math.max(confidence, 0.95);
  }
  if (base.name === "Article Page" && $("article").length > 0) {
    confidence = Math.max(confidence, 0.9);
  }
  if (base.name === "Homepage" && groups.has("Carousel")) {
    confidence = Math.max(confidence, 0.9);
  }

  return {
    name: base.name,
    confidence,
    source: "heuristic",
  };
}
