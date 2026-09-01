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
    let matchSet: ReturnType<typeof $> | null = null;
    try {
      matchSet = $(rule.selector);
    } catch {
      continue; // Malformed selector — skip rather than crashing the page.
    }
    const count = matchSet.length;
    if (count < rule.minCount) continue;

    const weighted = scoreRuleMatch($, rule, matchSet);
    if (weighted < 0.38) continue;

    const variantHint = collectDetectionHint($, rule.selector);
    const finalConfidence = clamp01(Math.max(rule.confidence, (rule.confidence * 0.7) + (weighted * 0.3)));
    const existing = byGroup.get(rule.groupName);
    if (!existing || finalConfidence > existing.confidence) {
      byGroup.set(rule.groupName, {
        groupName: rule.groupName,
        variantHint,
        confidence: finalConfidence,
        source: "heuristic",
        evidence: `${rule.evidence} (${weighted.toFixed(2)})`,
      });
    } else if (variantHint && existing.variantHint) {
      existing.variantHint = `${existing.variantHint} ${variantHint}`;
      existing.confidence = Math.max(existing.confidence, finalConfidence);
      if (existing.evidence && !existing.evidence.includes(rule.evidence)) {
        existing.evidence = `${existing.evidence}; ${rule.evidence}`;
      }
    } else if (variantHint) {
      existing.variantHint = variantHint;
      existing.confidence = Math.max(existing.confidence, finalConfidence);
    }
  }

  const detectedComponents = [...byGroup.values()].sort(
    (a, b) => b.confidence - a.confidence,
  );

  const detectedTemplate = detectTemplate($, pageType, detectedComponents);

  return { url, pageType, detectedComponents, detectedTemplate };
}

function scoreRuleMatch(
  $: ReturnType<typeof load>,
  rule: DetectionRule,
  matches: ReturnType<typeof $>,
): number {
  const count = matches.length;
  const baseCoverage = Math.min(1, count / Math.max(rule.minCount, 1));
  const signalSet = new Set<string>();
  const textSignals: string[] = [];

  matches.slice(0, 12).each((_, element) => {
    const node = $(element);
    const tag = "tagName" in element ? element.tagName.toLowerCase() : "";
    const className = node.attr("class") || "";
    const id = node.attr("id") || "";
    const role = node.attr("role") || "";
    const ariaLabel = node.attr("aria-label") || "";
    const text = node.text().replace(/\s+/g, " ").trim();

    if (tag) signalSet.add(`tag:${tag}`);
    if (className) signalSet.add(`class:${normalizeSignal(className)}`);
    if (id) signalSet.add(`id:${normalizeSignal(id)}`);
    if (role) signalSet.add(`role:${normalizeSignal(role)}`);
    if (ariaLabel) signalSet.add(`aria:${normalizeSignal(ariaLabel)}`);
    if (text) {
      textSignals.push(text.slice(0, 120));
      const normalized = normalizeSignal(text);
      if (normalized) signalSet.add(`text:${normalized}`);
    }
  });

  const semanticSignals = countSemanticSignals($, matches);
  const textStrength = detectTextStrength(textSignals.join(" "), rule.groupName);
  const repeatedStructure = count > rule.minCount ? 0.18 : 0;

  return clamp01(
    baseCoverage * 0.45 +
      semanticSignals * 0.3 +
      textStrength * 0.2 +
      repeatedStructure +
      Math.min(signalSet.size / 16, 0.15),
  );
}

function countSemanticSignals(
  $: ReturnType<typeof load>,
  matches: ReturnType<typeof $>,
): number {
  let score = 0;
  matches.slice(0, 12).each((_, element) => {
    const node = $(element);
    const tag = "tagName" in element ? element.tagName.toLowerCase() : "";
    const attrs = [
      node.attr("role"),
      node.attr("aria-label"),
      node.attr("aria-expanded"),
      node.attr("type"),
      node.attr("name"),
      node.attr("href"),
      node.attr("src"),
    ].filter(Boolean) as string[];

    if (["button", "input", "select", "textarea", "details", "summary", "nav", "form"].includes(tag)) {
      score += 0.22;
    }
    if (attrs.length > 0) score += Math.min(0.18, attrs.length * 0.05);
    if (node.text().trim()) score += 0.08;
  });
  return Math.min(1, score);
}

function detectTextStrength(text: string, groupName: string): number {
  const normalized = normalizeSignal(text);
  if (!normalized) return 0;

  const keywords: Record<string, string[]> = {
    CTA: ["shop", "buy", "learn", "sign", "book", "get started", "start now", "discover", "view all"],
    Search: ["search", "find", "results", "query"],
    Product: ["add to cart", "price", "sku", "product", "buy now"],
    Carousel: ["slide", "next", "previous", "featured", "popular"],
    Accordion: ["faq", "more", "details", "learn more"],
    Breadcrumbs: ["home", "products", "category", "breadcrumb"],
    Tabs: ["overview", "details", "reviews", "specs"],
    Teaser: ["read more", "learn more", "featured", "latest"],
  };

  const groupKeywords = keywords[groupName] ?? [];
  const matchCount = groupKeywords.filter((keyword) => normalized.includes(keyword)).length;
  if (matchCount > 0) return Math.min(1, 0.15 + matchCount * 0.2);
  return 0.08;
}

function normalizeSignal(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s-]+/g, " ").replace(/\s+/g, " ").trim();
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function collectDetectionHint(
  $: ReturnType<typeof load>,
  selector: string,
): string | undefined {
  const signals: string[] = [];
  try {
    $(selector).slice(0, 12).each((_, element) => {
      const attributes = ["class", "id", "aria-label", "role", "title", "data-testid"]
        .map((name) => $(element).attr(name))
        .filter((value): value is string => Boolean(value?.trim()));
      const text = $(element).text().replace(/\s+/g, " ").trim().slice(0, 120);
      signals.push(...attributes, text);
    });
  } catch {
    return undefined;
  }
  const hint = [...new Set(signals)].join(" ").trim();
  return hint || undefined;
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