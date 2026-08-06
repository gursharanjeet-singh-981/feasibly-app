import type { PageType } from "./types";

export interface DetectionRule {
  groupName: string;
  selector: string;
  minCount: number;
  confidence: number;
  evidence: string;
}

// Each rule must reference a real `group` from public/data/components.json.
// If multiple rules for the same groupName match, the analyzer takes the max
// confidence. Selectors use Cheerio's css-select syntax (jQuery-like).
export const COMPONENT_RULES: DetectionRule[] = [
  // --- Structural / layout ---
  { groupName: "Simple Header", selector: "header, [role=\"banner\"]", minCount: 1, confidence: 0.85, evidence: "header/banner" },
  {
    groupName: "Complex Header (Megamenu) Megamenu",
    selector:
      "[class*=\"megamenu\" i], nav[class*=\"mega\" i], header nav ul ul li, [data-megamenu]",
    minCount: 1,
    confidence: 0.75,
    evidence: "megamenu markers",
  },
  { groupName: "Breadcrumbs", selector: "nav[aria-label*=\"breadcrumb\" i], .breadcrumb, .breadcrumbs, [class*=\"breadcrumb\" i], [itemtype*=\"BreadcrumbList\"]", minCount: 1, confidence: 0.9, evidence: "breadcrumb container" },
  { groupName: "Container", selector: "section, [class*=\"container\" i], main > div", minCount: 2, confidence: 0.5, evidence: "section/container blocks" },
  { groupName: "Separator", selector: "hr, [role=\"separator\"]", minCount: 1, confidence: 0.8, evidence: "hr/role=separator" },

  // --- Text / media primitives ---
  { groupName: "Title", selector: "h1, h2, h3", minCount: 1, confidence: 0.6, evidence: "headings present" },
  { groupName: "Text", selector: "p", minCount: 3, confidence: 0.6, evidence: "3+ paragraphs" },
  { groupName: "Image", selector: "img, picture, figure img", minCount: 1, confidence: 0.7, evidence: "img/picture" },
  { groupName: "Link", selector: "a[href]", minCount: 1, confidence: 0.5, evidence: "anchor tags" },
  { groupName: "List", selector: "main ul, main ol, article ul, article ol", minCount: 1, confidence: 0.55, evidence: "ul/ol in content" },

  // --- Interactive ---
  { groupName: "CTA", selector: "button, input[type=\"submit\"], .btn, .cta, [class*=\"btn-\" i], a[class*=\"btn\" i], a[class*=\"cta\" i]", minCount: 1, confidence: 0.75, evidence: "button/CTA class" },
  { groupName: "Forms", selector: "form", minCount: 1, confidence: 0.85, evidence: "form element" },
  { groupName: "Registration", selector: "form[action*=\"register\" i], form[action*=\"signup\" i], form[action*=\"sign-up\" i], form[id*=\"register\" i], form[id*=\"signup\" i]", minCount: 1, confidence: 0.85, evidence: "register/signup form" },
  { groupName: "Registration", selector: "form input[type=\"password\"] ~ input[type=\"password\"]", minCount: 1, confidence: 0.75, evidence: "confirm password field" },
  { groupName: "Search", selector: "input[type=\"search\"], form[role=\"search\"], input[name=\"q\"], input[name=\"query\"], input[name=\"search\"], [role=\"searchbox\"]", minCount: 1, confidence: 0.9, evidence: "search input/role" },

  // --- Navigation-y ---
  { groupName: "Tabs", selector: "[role=\"tablist\"], .tabs, [class*=\"tab-list\" i], [class*=\"tabs__\" i]", minCount: 1, confidence: 0.85, evidence: "tablist/tab class" },
  { groupName: "Accordion", selector: "details, .accordion, [class*=\"accordion\" i], button[aria-expanded]", minCount: 1, confidence: 0.85, evidence: "details/accordion class" },
  { groupName: "Table of contents", selector: ".toc, [class*=\"table-of-contents\" i], nav[aria-label*=\"contents\" i], nav[aria-label*=\"on this page\" i]", minCount: 1, confidence: 0.85, evidence: "TOC class/aria" },
  { groupName: "Progress Bar", selector: "progress, [role=\"progressbar\"], .progress-bar, [class*=\"progress-bar\" i]", minCount: 1, confidence: 0.85, evidence: "progress element" },

  // --- Marketing surfaces ---
  { groupName: "Teaser", selector: ".teaser, [class*=\"teaser\" i]", minCount: 1, confidence: 0.65, evidence: "teaser class" },
  { groupName: "Carousel", selector: ".carousel, .slider, .swiper, [class*=\"carousel\" i], [class*=\"swiper\" i], [class*=\"slick\" i]", minCount: 1, confidence: 0.8, evidence: "carousel/slider class" },
  { groupName: "Category Carousel", selector: "[class*=\"category-carousel\" i], [class*=\"categories-carousel\" i]", minCount: 1, confidence: 0.8, evidence: "category-carousel class" },

  // --- Media / embed ---
  { groupName: "Embed", selector: "iframe, embed, video, audio", minCount: 1, confidence: 0.75, evidence: "iframe/embed/video" },
  { groupName: "PDF Viewer", selector: "iframe[src$=\".pdf\" i], iframe[src*=\".pdf?\" i], embed[type=\"application/pdf\"], object[type=\"application/pdf\"]", minCount: 1, confidence: 0.9, evidence: "pdf iframe/embed" },
  { groupName: "Download", selector: "a[href$=\".pdf\" i], a[href$=\".zip\" i], a[href$=\".doc\" i], a[href$=\".docx\" i], a[href$=\".xls\" i], a[href$=\".xlsx\" i], a[download]", minCount: 1, confidence: 0.85, evidence: "download link" },

  // --- Commerce ---
  { groupName: "Product (PDP)", selector: "[itemtype*=\"schema.org/Product\" i], [class*=\"product-detail\" i], [class*=\"pdp\" i], [class*=\"add-to-cart\" i], [class*=\"add-to-bag\" i], button[name*=\"add-to-cart\" i]", minCount: 1, confidence: 0.85, evidence: "product/PDP markers" },
  { groupName: "Product List (PLP)", selector: "[class*=\"product-list\" i], [class*=\"product-grid\" i], [class*=\"products-grid\" i], [class*=\"plp\" i]", minCount: 1, confidence: 0.8, evidence: "product list/grid class" },
  { groupName: "Product Teaser", selector: "[class*=\"product-teaser\" i], [class*=\"product-card\" i], [class*=\"product-tile\" i]", minCount: 1, confidence: 0.75, evidence: "product card/tile class" },
  { groupName: "Product Carousel", selector: "[class*=\"product-carousel\" i], [class*=\"products-slider\" i]", minCount: 1, confidence: 0.85, evidence: "product-carousel class" },
  { groupName: "Related Products", selector: "[class*=\"related-products\" i], [class*=\"you-may-also-like\" i], [class*=\"recommendations\" i], [class*=\"upsell\" i]", minCount: 1, confidence: 0.85, evidence: "related-products class" },
  { groupName: "Featured Category List", selector: "[class*=\"featured-categor\" i], [class*=\"category-list\" i], [class*=\"category-tiles\" i]", minCount: 1, confidence: 0.75, evidence: "featured-category class" },
  { groupName: "Commerce Teaser", selector: "[class*=\"teaser\" i][class*=\"product\" i], [class*=\"commerce-teaser\" i]", minCount: 1, confidence: 0.75, evidence: "commerce teaser class" },
  { groupName: "Commerce Content Fragment", selector: "[data-cq-content-fragment][class*=\"commerce\" i], [class*=\"commerce-content-fragment\" i]", minCount: 1, confidence: 0.8, evidence: "commerce content-fragment marker" },

  // --- Content fragments (AEM-ish) ---
  { groupName: "Content Fragment", selector: "[data-cq-content-fragment], [class*=\"content-fragment\" i]", minCount: 1, confidence: 0.7, evidence: "content-fragment marker" },
  { groupName: "Content Fragment List", selector: "[data-cq-cflist], [class*=\"content-fragment-list\" i]", minCount: 1, confidence: 0.7, evidence: "content-fragment-list marker" },
  { groupName: "Experience Fragment", selector: "[data-cq-experience-fragment], [class*=\"experience-fragment\" i], [class*=\"xf-\" i]", minCount: 1, confidence: 0.7, evidence: "experience-fragment marker" },

  // --- Misc ---
  { groupName: "Search Lister", selector: "[class*=\"search-lister\" i], [class*=\"search-results\" i], [class*=\"result-list\" i][class*=\"search\" i]", minCount: 1, confidence: 0.8, evidence: "search-results/lister class" },
];

// Maps the crawler's URL/title-based pageType to a template in
// public/data/templates.json. Confidence is intentionally moderate because
// URL heuristics alone can misfire; the analyzer may boost it when DOM
// markers agree.
export const TEMPLATE_MAP: Partial<Record<PageType, { name: string; confidence: number }>> = {
  home: { name: "Homepage", confidence: 0.85 },
  product: { name: "PDP", confidence: 0.8 },
  listing: { name: "Listing Page (ie: PLP, Blog landing)", confidence: 0.75 },
  article: { name: "Article Page", confidence: 0.8 },
  contact: { name: "Contact Page", confidence: 0.9 },
  search: { name: "Search Results Page", confidence: 0.9 },
  legal: { name: "Utility Template", confidence: 0.55 },
  landing: { name: "Landing Page (General Content)", confidence: 0.8 },
};
