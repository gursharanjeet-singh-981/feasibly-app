import type { Component, Template } from "@/types";
import type { DiscoveredPage, PageType, UnmatchedItem } from "./types";
import type { PageAnalysis } from "./analyzer";

const PAGE_TYPE_TO_TEMPLATE_NAMES: Record<PageType, string[]> = {
  home: ["Homepage"],
  "product-list": ["Listing Page (ie: PLP, Blog landing)", "Category Page"],
  "product-detail": ["PDP"],
  article: ["Article Page"],
  landing: ["Landing Page (General Content)"],
  search: ["Search Results Page"],
  contact: ["Contact Page"],
  other: [],
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

interface MatchAccumulator {
  confidence: number;
  pages: Set<string>;
}

export interface MatchResult {
  matchedComponentIds: Record<number, { confidence: number; pages: string[] }>;
  matchedTemplateIds: Record<number, { confidence: number; pages: string[] }>;
  unmatched: UnmatchedItem[];
}

export function matchLibrary(
  analyses: PageAnalysis[],
  discoveredPages: DiscoveredPage[],
  components: Component[],
  templates: Template[],
): MatchResult {
  const componentAcc = new Map<number, MatchAccumulator>();
  const unmatchedAcc = new Map<string, MatchAccumulator>();

  const componentsByGroup = new Map<string, Component[]>();
  for (const c of components) {
    if (!c.group) continue;
    const key = normalize(c.group);
    const list = componentsByGroup.get(key) ?? [];
    list.push(c);
    componentsByGroup.set(key, list);
  }

  for (const page of analyses) {
    for (const det of page.detected) {
      const key = normalize(det.group);
      const matches = componentsByGroup.get(key);
      if (matches && matches.length) {
        for (const c of matches) {
          const acc = componentAcc.get(c.id) ?? { confidence: 0, pages: new Set() };
          acc.confidence = Math.max(acc.confidence, det.confidence);
          acc.pages.add(page.url);
          componentAcc.set(c.id, acc);
        }
      } else {
        const acc = unmatchedAcc.get(det.group) ?? { confidence: 0, pages: new Set() };
        acc.confidence = Math.max(acc.confidence, det.confidence);
        acc.pages.add(page.url);
        unmatchedAcc.set(det.group, acc);
      }
    }
  }

  const templateAcc = new Map<number, MatchAccumulator>();
  const templatesByName = new Map<string, Template[]>();
  for (const t of templates) {
    const key = normalize(t.name);
    const list = templatesByName.get(key) ?? [];
    list.push(t);
    templatesByName.set(key, list);
  }

  for (const page of discoveredPages) {
    const names = PAGE_TYPE_TO_TEMPLATE_NAMES[page.pageType];
    for (const name of names) {
      const key = normalize(name);
      const matches = templatesByName.get(key);
      if (!matches) continue;
      for (const t of matches) {
        const acc = templateAcc.get(t.id) ?? { confidence: 0, pages: new Set() };
        acc.confidence = Math.max(acc.confidence, 0.85);
        acc.pages.add(page.url);
        templateAcc.set(t.id, acc);
      }
    }
  }

  const toRecord = (m: Map<number, MatchAccumulator>) => {
    const out: Record<number, { confidence: number; pages: string[] }> = {};
    for (const [id, acc] of m) {
      out[id] = { confidence: acc.confidence, pages: [...acc.pages] };
    }
    return out;
  };

  const unmatched: UnmatchedItem[] = [...unmatchedAcc]
    .map(([label, acc]) => ({
      label,
      confidence: acc.confidence,
      foundOnPages: [...acc.pages],
    }))
    .sort((a, b) => b.confidence - a.confidence);

  return {
    matchedComponentIds: toRecord(componentAcc),
    matchedTemplateIds: toRecord(templateAcc),
    unmatched,
  };
}
