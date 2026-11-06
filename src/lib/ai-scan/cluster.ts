import type { PageAnalysis, PageType } from "@/lib/scanner/types";
import { getPathTemplate } from "./template";

export interface PageFingerprint {
  url: string;
  pageType: PageType;
  template: string;
  /** Component groups the heuristic pass detected on this page. */
  groups: Set<string>;
}

export interface PageCluster {
  id: number;
  members: PageFingerprint[];
  /** URLs of the pages sent to the AI model for this cluster. */
  samples: string[];
}

export function fingerprintOf(analysis: PageAnalysis): PageFingerprint {
  return {
    url: analysis.url,
    pageType: analysis.pageType,
    template: getPathTemplate(analysis.url) ?? "",
    groups: new Set(analysis.detectedComponents.map((d) => d.groupName)),
  };
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const v of a) if (b.has(v)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

/**
 * Groups pages that share a page type and path template and whose detected component
 * sets are similar. Greedy: each page joins the first cluster whose leader is similar enough.
 */
export function clusterPages(
  pages: PageFingerprint[],
  threshold: number,
): PageFingerprint[][] {
  const buckets = new Map<string, PageFingerprint[]>();
  for (const page of pages) {
    const key = `${page.pageType}|${page.template}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(page);
    else buckets.set(key, [page]);
  }

  const clusters: PageFingerprint[][] = [];
  for (const bucket of buckets.values()) {
    const bucketClusters: PageFingerprint[][] = [];
    for (const page of bucket) {
      const home = bucketClusters.find(
        (members) => jaccard(members[0]!.groups, page.groups) >= threshold,
      );
      if (home) home.push(page);
      else bucketClusters.push([page]);
    }
    clusters.push(...bucketClusters);
  }
  return clusters.sort((a, b) => b.length - a.length);
}

/**
 * Picks the pages to send to the model for one cluster: the medoid (most typical page),
 * plus the least-similar page when the cluster is large enough to contain variation.
 */
export function pickSamples(
  members: PageFingerprint[],
  outlierSampleClusterSize: number,
): string[] {
  if (members.length === 1) return [members[0]!.url];

  let medoid = members[0]!;
  let bestScore = -1;
  for (const m of members) {
    const score = members.reduce((sum, other) => sum + jaccard(m.groups, other.groups), 0);
    if (score > bestScore) {
      bestScore = score;
      medoid = m;
    }
  }

  const samples = [medoid.url];
  if (members.length > outlierSampleClusterSize) {
    let outlier: PageFingerprint | undefined;
    let lowest = Infinity;
    for (const m of members) {
      if (m.url === medoid.url) continue;
      const sim = jaccard(medoid.groups, m.groups);
      if (sim < lowest) {
        lowest = sim;
        outlier = m;
      }
    }
    if (outlier) samples.push(outlier.url);
  }
  return samples;
}
