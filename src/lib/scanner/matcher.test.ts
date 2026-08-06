import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Component, Template } from "@/types";
import { matchDetections, type Library } from "./matcher";
import type { PageAnalysis } from "./types";

const libraryRoot = path.join(process.cwd(), "public", "data");
const library: Library = {
  components: JSON.parse(readFileSync(path.join(libraryRoot, "components.json"), "utf8")) as Component[],
  templates: JSON.parse(readFileSync(path.join(libraryRoot, "templates.json"), "utf8")) as Template[],
};

const ctaIds = library.components.filter((c) => c.group === "CTA").map((c) => c.id);
const carouselIds = library.components.filter((c) => c.group === "Carousel").map((c) => c.id);
const homepageIds = library.templates.filter((t) => t.name === "Homepage").map((t) => t.id);
const pdpIds = library.templates.filter((t) => t.name === "PDP").map((t) => t.id);

function analysis(overrides: Partial<PageAnalysis> & { url: string }): PageAnalysis {
  return {
    url: overrides.url,
    pageType: overrides.pageType ?? "other",
    detectedComponents: overrides.detectedComponents ?? [],
    detectedTemplate: overrides.detectedTemplate ?? null,
  };
}

describe("matchDetections — exact matching", () => {
  it("matches every component whose group name equals the detection (case-insensitive)", () => {
    const result = matchDetections(
      [
        analysis({
          url: "https://x.com/",
          detectedComponents: [
            { groupName: "cta", confidence: 0.8, source: "heuristic" },
          ],
        }),
      ],
      library,
    );
    expect(ctaIds.length).toBeGreaterThan(1);
    for (const id of ctaIds) {
      expect(result.matchedComponentIds[id]).toBeDefined();
      expect(result.matchedComponentIds[id].confidence).toBeCloseTo(0.8, 5);
      expect(result.matchedComponentIds[id].pages).toEqual(["https://x.com/"]);
    }
    expect(result.unmatched.filter((u) => u.kind === "component")).toHaveLength(0);
  });

  it("matches every template whose name equals the detection (case-insensitive)", () => {
    const result = matchDetections(
      [
        analysis({
          url: "https://x.com/",
          pageType: "home",
          detectedTemplate: { name: "homepage", confidence: 0.85, source: "heuristic" },
        }),
      ],
      library,
    );
    expect(homepageIds.length).toBeGreaterThan(0);
    for (const id of homepageIds) {
      expect(result.matchedTemplateIds[id]).toBeDefined();
      expect(result.matchedTemplateIds[id].confidence).toBeCloseTo(0.85, 5);
    }
  });

  it("uses stable IDs across matcher invocations", () => {
    const detection = {
      groupName: "Carousel",
      confidence: 0.75,
      source: "heuristic" as const,
    };
    const a = matchDetections(
      [analysis({ url: "https://x.com/a", detectedComponents: [detection] })],
      library,
    );
    const b = matchDetections(
      [analysis({ url: "https://x.com/b", detectedComponents: [detection] })],
      library,
    );
    expect(Object.keys(a.matchedComponentIds).sort()).toEqual(
      Object.keys(b.matchedComponentIds).sort(),
    );
    for (const id of carouselIds) {
      expect(a.matchedComponentIds[id]).toBeDefined();
      expect(b.matchedComponentIds[id]).toBeDefined();
    }
  });
});

describe("matchDetections — aggregation across pages", () => {
  it("takes max confidence and unions page URLs across detections", () => {
    const result = matchDetections(
      [
        analysis({
          url: "https://x.com/",
          detectedComponents: [
            { groupName: "CTA", confidence: 0.6, source: "heuristic" },
          ],
        }),
        analysis({
          url: "https://x.com/pricing",
          detectedComponents: [
            { groupName: "CTA", confidence: 0.9, source: "heuristic" },
          ],
        }),
      ],
      library,
    );
    for (const id of ctaIds) {
      expect(result.matchedComponentIds[id].confidence).toBeCloseTo(0.9, 5);
      expect(new Set(result.matchedComponentIds[id].pages)).toEqual(
        new Set(["https://x.com/", "https://x.com/pricing"]),
      );
    }
  });

  it("aggregates templates the same way", () => {
    const result = matchDetections(
      [
        analysis({
          url: "https://x.com/p/1",
          pageType: "product",
          detectedTemplate: { name: "PDP", confidence: 0.8, source: "heuristic" },
        }),
        analysis({
          url: "https://x.com/p/2",
          pageType: "product",
          detectedTemplate: { name: "PDP", confidence: 0.95, source: "heuristic" },
        }),
      ],
      library,
    );
    expect(pdpIds.length).toBeGreaterThan(0);
    for (const id of pdpIds) {
      expect(result.matchedTemplateIds[id].confidence).toBeCloseTo(0.95, 5);
      expect(result.matchedTemplateIds[id].pages).toHaveLength(2);
    }
  });
});

describe("matchDetections — fuzzy matching", () => {
  it("resolves a singular-form near-miss to the plural library group", () => {
    // "Breadcrumb" (singular) should fuzzy-match "Breadcrumbs" (plural, real library group).
    const result = matchDetections(
      [
        analysis({
          url: "https://x.com/",
          detectedComponents: [
            { groupName: "Breadcrumb", confidence: 0.7, source: "heuristic" },
          ],
        }),
      ],
      library,
    );
    const breadcrumbIds = library.components
      .filter((c) => c.group === "Breadcrumbs")
      .map((c) => c.id);
    expect(breadcrumbIds.length).toBeGreaterThan(0);
    for (const id of breadcrumbIds) {
      expect(result.matchedComponentIds[id]).toBeDefined();
      // Fuzzy confidence must be reduced relative to the raw 0.7 detection score.
      expect(result.matchedComponentIds[id].confidence).toBeLessThan(0.7);
      expect(result.matchedComponentIds[id].confidence).toBeGreaterThan(0);
    }
    expect(result.unmatched.some((u) => u.label === "Breadcrumb")).toBe(false);
  });

  it("resolves a common misspelling to the correct library group", () => {
    // "Accordian" -> "Accordion" (well below default 0.4 threshold at ~0.18).
    const result = matchDetections(
      [
        analysis({
          url: "https://x.com/",
          detectedComponents: [
            { groupName: "Accordian", confidence: 0.8, source: "heuristic" },
          ],
        }),
      ],
      library,
    );
    const accordionIds = library.components
      .filter((c) => c.group === "Accordion")
      .map((c) => c.id);
    expect(accordionIds.length).toBeGreaterThan(0);
    const anyMatched = accordionIds.some((id) => result.matchedComponentIds[id]);
    expect(anyMatched).toBe(true);
  });

  it("emits an unmatched entry when no fuzzy match crosses the threshold", () => {
    const result = matchDetections(
      [
        analysis({
          url: "https://x.com/",
          detectedComponents: [
            { groupName: "asdfghjkl-nonsense", confidence: 0.8, source: "heuristic" },
          ],
        }),
      ],
      library,
      { fuzzyThreshold: 0.2 },
    );
    const unmatched = result.unmatched.find((u) => u.label === "asdfghjkl-nonsense");
    expect(unmatched).toBeDefined();
    expect(unmatched?.kind).toBe("component");
    expect(unmatched?.confidence).toBe(0.8);
  });
});

describe("matchDetections — confidence gating", () => {
  it("drops detections below minConfidence before matching", () => {
    const result = matchDetections(
      [
        analysis({
          url: "https://x.com/",
          detectedComponents: [
            { groupName: "CTA", confidence: 0.1, source: "heuristic" },
          ],
        }),
      ],
      library,
      { minConfidence: 0.3 },
    );
    for (const id of ctaIds) {
      expect(result.matchedComponentIds[id]).toBeUndefined();
    }
    expect(result.unmatched).toHaveLength(0);
  });
});

describe("matchDetections — empty input", () => {
  it("returns empty records for no analyses", () => {
    const result = matchDetections([], library);
    expect(result.matchedComponentIds).toEqual({});
    expect(result.matchedTemplateIds).toEqual({});
    expect(result.unmatched).toEqual([]);
  });
});
