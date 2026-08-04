import type { CheerioAPI } from "cheerio";
import * as cheerio from "cheerio";

export interface DetectedComponent {
  group: string;
  count: number;
  confidence: number;
  evidence: string;
}

interface Rule {
  group: string;
  selector: string;
  minCount?: number;
  confidence: number;
}

const RULES: Rule[] = [
  { group: "Simple Header", selector: "header", confidence: 0.9 },
  {
    group: "Complex Header (Megamenu) Megamenu",
    selector: "header nav [aria-haspopup='true'], header nav [class*='megamenu' i], header nav [class*='mega-menu' i]",
    confidence: 0.85,
  },
  { group: "Breadcrumbs", selector: "nav[aria-label*='breadcrumb' i], [class*='breadcrumb' i]", confidence: 0.9 },
  { group: "CTA", selector: "a.btn, button, a[class*='btn' i], a[class*='button' i], [role='button']", minCount: 2, confidence: 0.7 },
  {
    group: "Accordion",
    selector: "[class*='accordion' i], details, [role='region'][aria-labelledby], [aria-expanded]:not(header [aria-expanded])",
    minCount: 2,
    confidence: 0.8,
  },
  { group: "Tabs", selector: "[role='tablist'], [class*='tabs' i] [role='tab']", confidence: 0.85 },
  {
    group: "Forms",
    selector: "form input, form textarea, form select",
    minCount: 2,
    confidence: 0.85,
  },
  {
    group: "Search",
    selector: "input[type='search'], form[role='search'], [aria-label*='search' i][role='search']",
    confidence: 0.9,
  },
  {
    group: "Carousel",
    selector: "[class*='carousel' i], [class*='slider' i], [class*='swiper' i], [data-swiper], [class*='slick' i]",
    confidence: 0.75,
  },
  {
    group: "Table of contents",
    selector: "nav[aria-label*='contents' i], [class*='toc' i], [class*='table-of-contents' i]",
    confidence: 0.7,
  },
  { group: "List", selector: "main ul, main ol", minCount: 2, confidence: 0.5 },
  {
    group: "Image",
    selector: "main img, main picture, main figure img",
    minCount: 3,
    confidence: 0.6,
  },
  {
    group: "Embed",
    selector: "iframe[src*='youtube' i], iframe[src*='vimeo' i], iframe[src*='youtu.be' i], video, [class*='embed' i]",
    confidence: 0.8,
  },
  {
    group: "Teaser",
    selector: "[class*='teaser' i], [class*='hero' i], [class*='banner' i]:not(nav [class*='banner' i])",
    confidence: 0.7,
  },
  {
    group: "Title",
    selector: "main h1, main h2, main h3",
    minCount: 2,
    confidence: 0.5,
  },
  {
    group: "Text",
    selector: "main p",
    minCount: 3,
    confidence: 0.4,
  },
  {
    group: "Separator",
    selector: "main hr, [role='separator']",
    minCount: 1,
    confidence: 0.6,
  },
  {
    group: "Download",
    selector: "a[href$='.pdf' i], a[href$='.docx' i], a[href$='.xlsx' i], a[download]",
    confidence: 0.85,
  },
  {
    group: "PDF Viewer",
    selector: "embed[type='application/pdf'], iframe[src$='.pdf' i], [class*='pdf-viewer' i]",
    confidence: 0.9,
  },
  {
    group: "Product Teaser",
    selector: "[class*='product-card' i], [class*='product-tile' i], [class*='product-teaser' i]",
    confidence: 0.85,
  },
  {
    group: "Product List (PLP)",
    selector: "[class*='product-list' i], [class*='product-grid' i], [data-testid*='product-list' i]",
    confidence: 0.85,
  },
  {
    group: "Product Carousel",
    selector: "[class*='product-carousel' i], [class*='product-slider' i]",
    confidence: 0.9,
  },
  {
    group: "Related Products",
    selector: "[class*='related-product' i], [data-related-products]",
    confidence: 0.9,
  },
  {
    group: "Product (PDP)",
    selector: "[itemtype*='schema.org/Product' i], [class*='product-details' i], [class*='pdp' i]",
    confidence: 0.85,
  },
  {
    group: "Category Carousel",
    selector: "[class*='category-carousel' i], [class*='category-slider' i]",
    confidence: 0.85,
  },
  {
    group: "Featured Category List",
    selector: "[class*='featured-categor' i], [class*='category-list' i]",
    confidence: 0.75,
  },
  {
    group: "Search Lister",
    selector: "[class*='search-results' i], [class*='search-lister' i]",
    confidence: 0.8,
  },
  {
    group: "Registration",
    selector: "form[action*='register' i], form[action*='signup' i], form input[name*='confirm' i][type='password']",
    confidence: 0.85,
  },
  {
    group: "Link",
    selector: "main a[href]",
    minCount: 5,
    confidence: 0.3,
  },
];

export interface PageAnalysis {
  url: string;
  detected: DetectedComponent[];
}

export function analyzeHtml(url: string, html: string): PageAnalysis {
  let $: CheerioAPI;
  try {
    $ = cheerio.load(html);
  } catch {
    return { url, detected: [] };
  }
  const detected: DetectedComponent[] = [];
  const byGroup = new Map<string, DetectedComponent>();
  for (const rule of RULES) {
    let count = 0;
    try {
      count = $(rule.selector).length;
    } catch {
      continue;
    }
    if (count < (rule.minCount ?? 1)) continue;
    const existing = byGroup.get(rule.group);
    if (existing) {
      existing.count += count;
      existing.confidence = Math.max(existing.confidence, rule.confidence);
      existing.evidence = `${existing.evidence}; ${rule.selector} (${count})`;
    } else {
      const item: DetectedComponent = {
        group: rule.group,
        count,
        confidence: rule.confidence,
        evidence: `${rule.selector} (${count})`,
      };
      byGroup.set(rule.group, item);
      detected.push(item);
    }
  }
  return { url, detected };
}
