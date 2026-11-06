import { describe, expect, it } from "vitest";
import { parseAiResponse } from "./provider";
import { mergeAiResults } from "./merge";
import type { PageAnalysis } from "@/lib/scanner/types";

const templates = ["Homepage", "PDP", "Checkout", "Store Locator"];
const groups = ["CTA", "Forms"];

describe("parseAiResponse template handling", () => {
  it("returns the library template name, canonicalised", () => {
    const out = parseAiResponse(
      JSON.stringify({ template: "store locator", components: [] }),
      groups,
      templates,
    );
    expect(out.template).toBe("Store Locator");
  });

  it("returns null for a template outside the library", () => {
    const out = parseAiResponse(
      JSON.stringify({ template: "Made Up Page", components: [] }),
      groups,
      templates,
    );
    expect(out.template).toBeNull();
  });

  it("returns null when the model omits the template", () => {
    const out = parseAiResponse(JSON.stringify({ components: [] }), groups, templates);
    expect(out.template).toBeNull();
  });
});

describe("mergeAiResults template handling", () => {
  const analysis = (url: string, template: PageAnalysis["detectedTemplate"] = null): PageAnalysis => ({
    url,
    pageType: "other",
    detectedComponents: [],
    detectedTemplate: template,
  });

  it("sets the AI template on the sampled page and cluster members", () => {
    const merged = mergeAiResults(
      [analysis("https://x/a/1"), analysis("https://x/a/2")],
      [{ sourceUrl: "https://x/a/1", memberUrls: ["https://x/a/2"], detections: [], template: "Checkout" }],
      0.5,
    );
    expect(merged[0]!.detectedTemplate).toMatchObject({ name: "Checkout", source: "ai" });
    expect(merged[1]!.detectedTemplate?.name).toBe("Checkout");
    expect(merged[1]!.detectedTemplate!.confidence).toBeLessThan(merged[0]!.detectedTemplate!.confidence);
  });

  it("keeps a more confident URL-based template over the AI template", () => {
    const merged = mergeAiResults(
      [analysis("https://x/", { name: "Homepage", confidence: 0.95, source: "heuristic" })],
      [{ sourceUrl: "https://x/", memberUrls: [], detections: [], template: "PDP" }],
      0.5,
    );
    expect(merged[0]!.detectedTemplate?.name).toBe("Homepage");
  });

  it("leaves templates unchanged when AI picked none", () => {
    const merged = mergeAiResults(
      [analysis("https://x/a")],
      [{ sourceUrl: "https://x/a", memberUrls: [], detections: [], template: null }],
      0.5,
    );
    expect(merged[0]!.detectedTemplate).toBeNull();
  });
});
