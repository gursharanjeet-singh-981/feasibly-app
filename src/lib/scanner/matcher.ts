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

interface VariantSelection<T extends Component> {
  item: T;
  confidence: number;
  reason: string;
}

function selectVariants<T extends Component>(items: T[], hints: string[]): VariantSelection<T>[] {
  const defaultItem = items.find((item) => /\b(?:standard|default)\b/i.test(item.name)) ?? items[0]!;
  const hintTokens = tokenize(hints.join(" "));
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

  const selected = ranked.filter(({ score }) => score >= 0.35);
  if (selected.length === 0) {
    return [{
      item: defaultItem,
      confidence: 0.7,
      reason: "DOM evidence was present but did not clear the variant threshold; selected the standard/default variant.",
    }];
  }
  return selected.map(({ item, score }) => ({
    item,
    confidence: 0.7 + score * 0.3,
    reason: `Selected because DOM evidence matched this variant description (score ${Math.round(score * 100)}%). Multiple variants may be required on this page.`,
  }));
}

function scoreVariant(item: Component, hintTokens: Set<string>): number {
  const descriptionTokens = tokenize(
    [item.designDescription, item.developmentDescription, item.assumptions].join(" "),
  );
  const nameTokens = tokenize(item.name);
  let descriptionMatches = 0;
  let nameMatches = 0;
  for (const token of hintTokens) {
    if (descriptionTokens.has(token)) descriptionMatches++;
    if (nameTokens.has(token)) nameMatches++;
  }
  return Math.min(
    1,
    (descriptionMatches / hintTokens.size) * 0.85 +
      (nameMatches / hintTokens.size) * 0.15,
  );
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