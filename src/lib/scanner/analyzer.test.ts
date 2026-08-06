import { describe, expect, it } from "vitest";
import { analyzePage } from "./analyzer";
import { COMPONENT_RULES } from "./constants";
import type { PageType } from "./types";

const wrap = (body: string) =>
  `<!doctype html><html><head><title>t</title></head><body>${body}</body></html>`;

const negativeBody = wrap("<div>just some text with no matchable markers</div>");

interface Case {
  group: string;
  positive: string;
  negative?: string; // defaults to negativeBody
}

const CASES: Case[] = [
  { group: "Simple Header", positive: wrap("<header>Site</header>") },
  { group: "Complex Header (Megamenu) Megamenu", positive: wrap("<header><nav class=\"megamenu\"><ul><li>a</li></ul></nav></header>") },
  { group: "Breadcrumbs", positive: wrap("<nav aria-label=\"Breadcrumb\"><ol><li>Home</li></ol></nav>") },
  { group: "Container", positive: wrap("<section>a</section><section>b</section>") },
  { group: "Separator", positive: wrap("<p>a</p><hr><p>b</p>") },
  { group: "Title", positive: wrap("<h1>Big</h1>") },
  { group: "Text", positive: wrap("<p>a</p><p>b</p><p>c</p>") },
  { group: "Image", positive: wrap("<img src=\"/x.png\" alt=\"x\">") },
  { group: "Link", positive: wrap("<a href=\"/about\">a</a>") },
  { group: "List", positive: wrap("<main><ul><li>one</li></ul></main>") },
  { group: "CTA", positive: wrap("<button>Buy now</button>") },
  { group: "Forms", positive: wrap("<form><input name=\"x\"></form>") },
  { group: "Registration", positive: wrap("<form action=\"/signup\"><input type=\"email\"><input type=\"password\"></form>") },
  { group: "Search", positive: wrap("<form role=\"search\"><input type=\"search\" name=\"q\"></form>") },
  { group: "Tabs", positive: wrap("<div role=\"tablist\"><button role=\"tab\">A</button></div>") },
  { group: "Accordion", positive: wrap("<details><summary>t</summary>c</details>") },
  { group: "Table of contents", positive: wrap("<nav aria-label=\"On this page\"><ul><li>a</li></ul></nav>") },
  { group: "Progress Bar", positive: wrap("<progress value=\"30\" max=\"100\"></progress>") },
  { group: "Teaser", positive: wrap("<div class=\"teaser\">Read more</div>") },
  { group: "Carousel", positive: wrap("<div class=\"carousel\"><div>1</div></div>") },
  { group: "Category Carousel", positive: wrap("<div class=\"category-carousel\">x</div>") },
  { group: "Embed", positive: wrap("<iframe src=\"https://youtube.com/embed/x\"></iframe>") },
  { group: "PDF Viewer", positive: wrap("<iframe src=\"/docs/spec.pdf\"></iframe>") },
  { group: "Download", positive: wrap("<a href=\"/brief.pdf\">Download PDF</a>") },
  { group: "Product (PDP)", positive: wrap("<section itemtype=\"https://schema.org/Product\"><button class=\"add-to-cart\">Add</button></section>") },
  { group: "Product List (PLP)", positive: wrap("<div class=\"product-list\"><div>1</div></div>") },
  { group: "Product Teaser", positive: wrap("<article class=\"product-card\"><h2>Item</h2></article>") },
  { group: "Product Carousel", positive: wrap("<div class=\"product-carousel\">x</div>") },
  { group: "Related Products", positive: wrap("<section class=\"related-products\">x</section>") },
  { group: "Featured Category List", positive: wrap("<section class=\"featured-categories\">x</section>") },
  { group: "Commerce Teaser", positive: wrap("<div class=\"teaser product-teaser\">x</div>") },
  { group: "Commerce Content Fragment", positive: wrap("<div class=\"commerce-content-fragment\">x</div>") },
  { group: "Content Fragment", positive: wrap("<div class=\"content-fragment\">x</div>") },
  { group: "Content Fragment List", positive: wrap("<div class=\"content-fragment-list\">x</div>") },
  { group: "Experience Fragment", positive: wrap("<div class=\"experience-fragment\">x</div>") },
  { group: "Search Lister", positive: wrap("<div class=\"search-results\">x</div>") },
];

describe("analyzer rule coverage", () => {
  it("has at least one rule for every case group", () => {
    const rulesByGroup = new Set(COMPONENT_RULES.map((r) => r.groupName));
    for (const c of CASES) {
      expect(rulesByGroup.has(c.group), `missing rule for ${c.group}`).toBe(true);
    }
  });

  it.each(CASES)("detects $group in a positive fixture", ({ group, positive }) => {
    const result = analyzePage({
      url: "https://x.com/",
      html: positive,
      pageType: "other",
    });
    const hit = result.detectedComponents.find((c) => c.groupName === group);
    expect(hit, `expected ${group} to be detected`).toBeTruthy();
    expect(hit?.source).toBe("heuristic");
    expect(hit?.confidence).toBeGreaterThan(0);
  });

  it.each(CASES)("does not detect $group in a negative fixture", ({ group }) => {
    const result = analyzePage({
      url: "https://x.com/",
      html: negativeBody,
      pageType: "other",
    });
    const hit = result.detectedComponents.find((c) => c.groupName === group);
    expect(hit, `unexpected detection of ${group}`).toBeFalsy();
  });
});

describe("analyzer template detection", () => {
  const cases: Array<{ pageType: PageType; html: string; name: string | null; minConfidence?: number }> = [
    { pageType: "home", html: wrap("<div>welcome</div>"), name: "Homepage" },
    { pageType: "product", html: wrap("<div>x</div>"), name: "PDP" },
    { pageType: "listing", html: wrap("<div>x</div>"), name: "Listing Page (ie: PLP, Blog landing)" },
    { pageType: "article", html: wrap("<article>x</article>"), name: "Article Page", minConfidence: 0.9 },
    { pageType: "contact", html: wrap("<form>x</form>"), name: "Contact Page" },
    { pageType: "search", html: wrap("<div>x</div>"), name: "Search Results Page" },
    { pageType: "landing", html: wrap("<div>x</div>"), name: "Landing Page (General Content)" },
    { pageType: "legal", html: wrap("<div>x</div>"), name: "Utility Template" },
    { pageType: "other", html: wrap("<div>x</div>"), name: null },
  ];

  it.each(cases)("maps pageType=$pageType to $name", ({ pageType, html, name, minConfidence }) => {
    const result = analyzePage({ url: "https://x.com/", html, pageType });
    if (name === null) {
      expect(result.detectedTemplate).toBeNull();
    } else {
      expect(result.detectedTemplate?.name).toBe(name);
      if (minConfidence !== undefined) {
        expect(result.detectedTemplate!.confidence).toBeGreaterThanOrEqual(minConfidence);
      }
    }
  });

  it("boosts PDP confidence when Product markers are present", () => {
    const html = wrap(
      "<section itemtype=\"https://schema.org/Product\"><button class=\"add-to-cart\">Add</button></section>",
    );
    const result = analyzePage({ url: "https://x.com/p/1", html, pageType: "product" });
    expect(result.detectedTemplate?.name).toBe("PDP");
    expect(result.detectedTemplate!.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it("boosts Homepage confidence when a Carousel is present", () => {
    const html = wrap("<div class=\"carousel\">x</div>");
    const result = analyzePage({ url: "https://x.com/", html, pageType: "home" });
    expect(result.detectedTemplate?.name).toBe("Homepage");
    expect(result.detectedTemplate!.confidence).toBeGreaterThanOrEqual(0.9);
  });
});

describe("analyzer robustness", () => {
  it("returns an empty result for empty HTML without throwing", () => {
    const result = analyzePage({ url: "https://x.com/", html: "", pageType: "other" });
    expect(result.detectedComponents).toEqual([]);
    expect(result.detectedTemplate).toBeNull();
  });

  it("collapses multiple matching rules for the same group to one detection", () => {
    // Registration has two rules (action-based + confirm-password field).
    // Match both and expect a single detection with the higher confidence.
    const html = wrap(
      "<form action=\"/signup\"><input type=\"password\"><input type=\"password\"></form>",
    );
    const result = analyzePage({ url: "https://x.com/register", html, pageType: "other" });
    const regHits = result.detectedComponents.filter((c) => c.groupName === "Registration");
    expect(regHits).toHaveLength(1);
    expect(regHits[0].confidence).toBeGreaterThanOrEqual(0.85);
  });

  it("sorts detected components by descending confidence", () => {
    const html = wrap(
      "<header>h</header><p>a</p><p>b</p><p>c</p><form><input></form>",
    );
    const result = analyzePage({ url: "https://x.com/", html, pageType: "other" });
    for (let i = 1; i < result.detectedComponents.length; i++) {
      expect(result.detectedComponents[i - 1].confidence).toBeGreaterThanOrEqual(
        result.detectedComponents[i].confidence,
      );
    }
  });
});
