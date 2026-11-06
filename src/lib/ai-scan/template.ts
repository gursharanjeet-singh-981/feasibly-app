// Path-template helper, kept free of server imports so browser code can use it.
/** Parent-path "template" key for a URL, or null for root and single-segment paths. */
export function getPathTemplate(url: string): string | null {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    return "/" + parts.slice(0, -1).join("/");
  } catch {
    return null;
  }
}
