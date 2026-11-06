import type { DetectedComponent, DetectedTemplate, PageAnalysis } from "@/lib/scanner/types";
import type { AiDetection } from "./provider";

/** Confidence given to a template the AI picked for the page it actually looked at. */
const AI_TEMPLATE_CONFIDENCE = 0.85;

export interface AiSampleResult {
  /** The page the model actually looked at. */
  sourceUrl: string;
  /** Similar pages in the same cluster that inherit this result at reduced confidence. */
  memberUrls: string[];
  detections: AiDetection[];
  /** Template the AI picked, or null. */
  template: string | null;
}

/**
 * Adds AI detections to heuristic analyses. Heuristic detections are always kept:
 * AI can add or raise a component's confidence, but never removes one.
 */
export function mergeAiResults(
  analyses: PageAnalysis[],
  results: AiSampleResult[],
  propagatedFactor: number,
): PageAnalysis[] {
  const extra = new Map<string, DetectedComponent[]>();
  for (const result of results) {
    const targets = [result.sourceUrl, ...result.memberUrls];
    for (const url of targets) {
      const factor = url === result.sourceUrl ? 1 : propagatedFactor;
      const list = extra.get(url) ?? [];
      for (const d of result.detections) {
        list.push({
          groupName: d.groupName,
          confidence: Math.min(1, d.confidence * factor),
          source: "ai",
          evidence:
            url === result.sourceUrl
              ? `AI: ${d.evidence}`
              : `AI (similar page ${result.sourceUrl}): ${d.evidence}`,
        });
      }
      extra.set(url, list);
    }
  }

  // Template picked by AI for each page: the sample itself, and its cluster members.
  const templateFor = new Map<string, DetectedTemplate>();
  for (const result of results) {
    if (!result.template) continue;
    templateFor.set(result.sourceUrl, {
      name: result.template,
      confidence: AI_TEMPLATE_CONFIDENCE,
      source: "ai",
    });
    for (const url of result.memberUrls) {
      templateFor.set(url, {
        name: result.template,
        confidence: AI_TEMPLATE_CONFIDENCE * propagatedFactor,
        source: "ai",
      });
    }
  }

  return analyses.map((analysis) => {
    const additions = extra.get(analysis.url) ?? [];
    const aiTemplate = templateFor.get(analysis.url);
    if (additions.length === 0 && !aiTemplate) return analysis;

    const byGroup = new Map<string, DetectedComponent>();
    for (const d of analysis.detectedComponents) byGroup.set(d.groupName, d);
    for (const add of additions) {
      const existing = byGroup.get(add.groupName);
      if (!existing) {
        byGroup.set(add.groupName, add);
      } else if (add.confidence > existing.confidence) {
        byGroup.set(add.groupName, {
          ...existing,
          confidence: add.confidence,
          source: "ai",
          evidence: `${add.evidence}; ${existing.evidence ?? ""}`.trim(),
        });
      }
    }

    // AI template replaces the URL-based one only when it is at least as confident.
    const current = analysis.detectedTemplate;
    const detectedTemplate =
      aiTemplate && (!current || aiTemplate.confidence >= current.confidence)
        ? aiTemplate
        : current;

    return {
      ...analysis,
      detectedComponents: [...byGroup.values()].sort((a, b) => b.confidence - a.confidence),
      detectedTemplate,
    };
  });
}
