import { load } from "cheerio";

// Attributes that carry component signal. Everything else (inline styles, tracking
// attributes, long data blobs) is dropped to keep the prompt small.
const KEEP_EXACT = new Set([
  "class",
  "id",
  "role",
  "type",
  "name",
  "href",
  "src",
  "download",
  "itemtype",
  "title",
  "action",
  "data-testid",
]);
const KEEP_PREFIX = ["aria-", "data-cq-", "data-megamenu"];
const MAX_ATTR_LENGTH = 200;

/**
 * Reduces a page to the markup the model needs: body only, no scripts/styles/SVG,
 * only signal-bearing attributes, whitespace collapsed, and capped in length.
 */
export function cleanHtmlForModel(html: string, maxChars: number): string {
  const $ = load(html);
  $("script, style, svg, noscript, link, meta, template, iframe").remove();

  $("*").each((_, el) => {
    if (!("attribs" in el)) return;
    const attribs = el.attribs as Record<string, string>;
    for (const key of Object.keys(attribs)) {
      const keep = KEEP_EXACT.has(key) || KEEP_PREFIX.some((p) => key.startsWith(p));
      if (!keep) {
        delete attribs[key];
        continue;
      }
      if (attribs[key] && attribs[key].length > MAX_ATTR_LENGTH) {
        attribs[key] = attribs[key].slice(0, MAX_ATTR_LENGTH);
      }
    }
  });

  const body = $("body").html() ?? $.root().html() ?? "";
  return body.replace(/<!--[\s\S]*?-->/g, "").replace(/\s+/g, " ").trim().slice(0, maxChars);
}
