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
      applyMatch(matchedComponentIds, exact, det.confidence, det.pages);
      continue;
    }
    const fuzzy = componentIndex.search(det.groupName)[0];
    if (fuzzy && (fuzzy.score ?? 1) <= fuzzyThreshold) {
      const groupKey = fuzzy.item.group.toLowerCase();
      const members = componentsByGroup.get(groupKey) ?? [fuzzy.item];
      const conf = det.confidence * (1 - (fuzzy.score ?? 0));
      applyMatch(matchedComponentIds, members, conf, det.pages);
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
      const key = det.groupName.toLowerCase();
      const prev = acc.get(key);
      if (!prev) {
        acc.set(key, {
          groupName: det.groupName,
          confidence: det.confidence,
          pages: [analysis.url],
        });
      } else {
        prev.confidence = Math.max(prev.confidence, det.confidence);
        if (!prev.pages.includes(analysis.url)) prev.pages.push(analysis.url);
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

function applyMatch<T extends { id: number }>(
  target: Record<number, MatchMetadata>,
  items: T[],
  confidence: number,
  pages: string[],
): void {
  const conf = clamp01(confidence);
  for (const item of items) {
    const existing = target[item.id];
    if (!existing) {
      target[item.id] = { confidence: conf, pages: [...pages] };
      continue;
    }
    existing.confidence = Math.max(existing.confidence, conf);
    for (const p of pages) {
      if (!existing.pages.includes(p)) existing.pages.push(p);
    }
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