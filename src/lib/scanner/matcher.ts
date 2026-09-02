import Fuse from "fuse.js";
import type { Component, Template } from "@/types";
import type {
  DetectedComponent,
  DetectedTemplate,
  MatchMetadata,
  PageAnalysis,
  UnmatchedItem,
} from "./types";

export interface Library {
  components: Component[];
  templates: Template[];
}

export interface MatchResult {
  matchedComponentIds: Record<number, MatchMetadata>;
  matchedTemplateIds: Record<number, MatchMetadata>;
  unmatched: UnmatchedItem[];
}

export interface MatcherOptions {
  fuzzyThreshold?: number; // Fuse `threshold`; 0 = exact, 1 = anything.
  minConfidence?: number; // Drop detections below this before matching.
}

const DEFAULT_FUZZY_THRESHOLD = 0.4;
const DEFAULT_MIN_CONFIDENCE = 0.3;

export function matchDetections(
  analyses: PageAnalysis[],
  library: Library,
  options: MatcherOptions = {},
): MatchResult {
  const { fuzzyThreshold = DEFAULT_FUZZY_THRESHOLD, minConfidence = DEFAULT_MIN_CONFIDENCE } = options;

  const componentDetections = aggregateComponents(analyses, minConfidence);
  const templateDetections = aggregateTemplates(analyses, minConfidence);
  const pageTypeTemplateDetections = aggregatePageTypeTemplates(analyses, minConfidence);

  const componentsByGroup = groupBy(library.components, (c) => c.group.toLowerCase());
  const templatesByName = groupBy(library.templates, (t) => t.name.toLowerCase());

  const componentIndex = new Fuse(library.components, {
    includeScore: true,
    threshold: fuzzyThreshold,
    ignoreLocation: true,
    keys: [
      { name: "group", weight: 0.6 },
      { name: "name", weight: 0.3 },
      { name: "designDescription", weight: 0.1 },
    ],
  });
  const templateIndex = new Fuse(library.templates, {
    includeScore: true,
    threshold: fuzzyThreshold,
    ignoreLocation: true,
    keys: [
      { name: "name", weight: 0.7 },
      { name: "description", weight: 0.3 },
    ],
  });

  const matchedComponentIds: Record<number, MatchMetadata> = {};
  const matchedTemplateIds: Record<number, MatchMetadata> = {};
  const unmatched: UnmatchedItem[] = [];

  for (const det of componentDetections) {
    const key = det.groupName.toLowerCase();
    const exact = componentsByGroup.get(key);
    if (exact && exact.length > 0) {
      for (const variant of selectVariants(exact, det.variantHints)) {
        applyMatch(
          matchedComponentIds,
          [variant.item],
          det.confidence * variant.confidence,
          det.pages,
          variant.reason,
          det.groupName,
        );
      }
      continue;
    }
    const fuzzy = componentIndex.search(det.groupName)[0];
    if (fuzzy && (fuzzy.score ?? 1) <= fuzzyThreshold) {
      const groupKey = fuzzy.item.group.toLowerCase();
      const members = componentsByGroup.get(groupKey) ?? [fuzzy.item];
      const conf = det.confidence * (1 - (fuzzy.score ?? 0));
      for (const variant of selectVariants(members, det.variantHints)) {
        applyMatch(
          matchedComponentIds,
          [variant.item],
          conf * variant.confidence,
          det.pages,
          variant.reason,
          fuzzy.item.group,
        );
      }
      continue;
    }
    unmatched.push({
      label: det.groupName,
      kind: "component",
      pages: det.pages,
      confidence: det.confidence,
    });
  }

  for (const det of templateDetections) {
    const key = det.name.toLowerCase();
    const exact = templatesByName.get(key);
    if (exact && exact.length > 0) {
      applyMatch(matchedTemplateIds, exact, det.confidence, det.pages);
      continue;
    }
    const fuzzy = templateIndex.search(det.name)[0];
    if (fuzzy && (fuzzy.score ?? 1) <= fuzzyThreshold) {
      const nameKey = fuzzy.item.name.toLowerCase();
      const members = templatesByName.get(nameKey) ?? [fuzzy.item];
      const conf = det.confidence * (1 - (fuzzy.score ?? 0));
      applyMatch(matchedTemplateIds, members, conf, det.pages);
      continue;
    }
    unmatched.push({
      label: det.name,
      kind: "template",
      pages: det.pages,
      confidence: det.confidence,
    });
  }

  for (const det of pageTypeTemplateDetections) {
    const exact = templatesByName.get(det.name.toLowerCase());
    if (exact && exact.length > 0) {
      applyMatch(matchedTemplateIds, exact, det.confidence, det.pages, "Page type strongly suggests this template.");
      continue;
    }
    const fuzzy = templateIndex.search(det.name)[0];
    if (fuzzy && (fuzzy.score ?? 1) <= fuzzyThreshold) {
      const members = templatesByName.get(fuzzy.item.name.toLowerCase()) ?? [fuzzy.item];
      const conf = det.confidence * (1 - (fuzzy.score ?? 0));
      applyMatch(matchedTemplateIds, members, conf, det.pages, "Page type is consistent with this template.");
    }
  }

  return { matchedComponentIds, matchedTemplateIds, unmatched };
}

// ---------- internals ----------

interface AggregatedComponent {
  groupName: string;
  confidence: number;
  pages: string[];
  variantHints: string[];
}

interface AggregatedTemplate {
  name: string;
  confidence: number;
  pages: string[];
}

const PAGE_TYPE_TO_TEMPLATE: Record<string, string> = {
  home: "Homepage",
  product: "PDP",
  listing: "Listing Page (ie: PLP, Blog landing)",
  article: "Article Page",
  contact: "Contact Page",
  search: "Search Results Page",
  legal: "Utility Template",
  landing: "Landing Page (General Content)",
};

function aggregateComponents(
  analyses: PageAnalysis[],
  minConfidence: number,
): AggregatedComponent[] {
  const acc = new Map<string, AggregatedComponent>();
  for (const analysis of analyses) {
    for (const det of analysis.detectedComponents as DetectedComponent[]) {
      if (det.confidence < minConfidence) continue;
      const key = `${analysis.url}\u0000${det.groupName.toLowerCase()}`;
      const prev = acc.get(key);
      if (!prev) {
        acc.set(key, {
          groupName: det.groupName,
          confidence: det.confidence,
          pages: [analysis.url],
          variantHints: det.variantHint?.trim() ? [det.variantHint] : [],
        });
      } else {
        prev.confidence = Math.max(prev.confidence, det.confidence);
        if (!prev.pages.includes(analysis.url)) prev.pages.push(analysis.url);
        for (const hint of [det.variantHint]) {
          if (hint?.trim() && !prev.variantHints.includes(hint)) {
            prev.variantHints.push(hint);
          }
        }
      }
    }
  }
  return [...acc.values()];
}

function aggregateTemplates(
  analyses: PageAnalysis[],
  minConfidence: number,
): AggregatedTemplate[] {
  const acc = new Map<string, AggregatedTemplate>();
  for (const analysis of analyses) {
    const det: DetectedTemplate | null = analysis.detectedTemplate;
    if (!det) continue;
    if (det.confidence < minConfidence) continue;
    const key = det.name.toLowerCase();
    const prev = acc.get(key);
    if (!prev) {
      acc.set(key, {
        name: det.name,
        confidence: det.confidence,
        pages: [analysis.url],
      });
    } else {
      prev.confidence = Math.max(prev.confidence, det.confidence);
      if (!prev.pages.includes(analysis.url)) prev.pages.push(analysis.url);
    }
  }
  return [...acc.values()];
}

function aggregatePageTypeTemplates(
  analyses: PageAnalysis[],
  minConfidence: number,
): AggregatedTemplate[] {
  const acc = new Map<string, AggregatedTemplate>();
  for (const analysis of analyses) {
    const templateName = PAGE_TYPE_TO_TEMPLATE[analysis.pageType];
    if (!templateName) continue;
    const templateConfidence = Math.max(0.55, 0.75 - (analysis.detectedTemplate ? 0.15 : 0));
    if (templateConfidence < minConfidence) continue;

    const key = templateName.toLowerCase();
    const prev = acc.get(key);
    if (!prev) {
      acc.set(key, {
        name: templateName,
        confidence: templateConfidence,
        pages: [analysis.url],
      });
    } else {
      prev.confidence = Math.max(prev.confidence, templateConfidence);
      if (!prev.pages.includes(analysis.url)) prev.pages.push(analysis.url);
    }
  }
  return [...acc.values()];
}

interface VariantSelection<T extends Component> {
  item: T;
  confidence: number;
  reason: string;
}

function selectVariants<T extends Component>(items: T[], hints: string[]): VariantSelection<T>[] {
  const defaultItem = items.find((item) => /\b(?:standard|default)\b/i.test(item.name)) ?? items[0]!;
  const hintTokens = tokenize(hints.join(" "));
  const groupTokens = tokenize(defaultItem.group);
  for (const token of groupTokens) hintTokens.delete(token);
  if (hintTokens.size === 0) {
    return [{
      item: defaultItem,
      confidence: 1,
      reason: "No variant-specific DOM evidence was found; selected the standard/default variant.",
    }];
  }

  const ranked = items
    .map((item) => ({ item, score: scoreVariant(item, hintTokens) }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0]!;
  if (best.score === 0) {
    return [{
      item: defaultItem,
      confidence: 0.7,
      reason: "DOM evidence did not match a specific variant description; selected the standard/default variant.",
    }];
  }

  const selected = ranked.filter(({ score }) => score >= 0.18);
  if (selected.length === 0) {
    return [{
      item: defaultItem,
      confidence: 0.7,
      reason: "DOM evidence was present but did not clear the variant threshold; selected the standard/default variant.",
    }];
  }

  const topScore = selected[0].score;
  const threshold = Math.max(0.18, topScore * 0.55);
  const relevant = selected.filter(({ score }) => score >= threshold);

  return relevant.map(({ item, score }) => ({
    item,
    confidence: 0.7 + score * 0.3,
    reason: `Selected because DOM evidence matched this variant description (score ${Math.round(score * 100)}%). Multiple variants may be required on this page.`,
  }));
}

function scoreVariant(item: Component, hintTokens: Set<string>): number {
  const allText = [
    item.name,
    item.group,
    item.designDescription,
    item.developmentDescription,
    item.assumptions,
  ].join(" ");
  const allTokens = tokenize(allText);
  const descriptionTokens = tokenize(
    [item.designDescription, item.developmentDescription, item.assumptions].join(" "),
  );
  const nameTokens = tokenize(item.name);
  const groupTokens = tokenize(item.group);

  let descriptionMatches = 0;
  let nameMatches = 0;
  let groupMatches = 0;
  let exactPhraseMatches = 0;

  for (const token of hintTokens) {
    if (descriptionTokens.has(token)) descriptionMatches++;
    if (nameTokens.has(token)) nameMatches++;
    if (groupTokens.has(token)) groupMatches++;
    if (allTokens.has(token)) exactPhraseMatches++;
  }

  const baseScore =
    (descriptionMatches / Math.max(1, hintTokens.size)) * 0.7 +
    (nameMatches / Math.max(1, hintTokens.size)) * 0.2 +
    (groupMatches / Math.max(1, hintTokens.size)) * 0.1;

  const phraseBonus = exactPhraseMatches > 0 ? 0.12 : 0;
  const defaultBias = /\b(?:standard|default)\b/i.test(item.name) ? 0.05 : 0;

  return Math.min(1, baseScore + phraseBonus + defaultBias);
}

function tokenize(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 2 && !STOP_WORDS.has(token)),
  );
}

const STOP_WORDS = new Set([
  "and", "the", "with", "for", "from", "this", "that", "used", "via",
  "basic", "standard", "default", "component", "content", "layout",
]);

function applyMatch<T extends { id: number }>(
  target: Record<number, MatchMetadata>,
  items: T[],
  confidence: number,
  pages: string[],
  reason?: string,
  group?: string,
): void {
  const conf = clamp01(confidence);
  for (const item of items) {
    const existing = target[item.id];
    if (!existing) {
      target[item.id] = { confidence: conf, pages: [...pages], reason, group };
      continue;
    }
    existing.confidence = Math.max(existing.confidence, conf);
    for (const p of pages) {
      if (!existing.pages.includes(p)) existing.pages.push(p);
    }
    if (!existing.reason && reason) existing.reason = reason;
  }
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const bucket = m.get(k);
    if (bucket) bucket.push(item);
    else m.set(k, [item]);
  }
  return m;
}

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}