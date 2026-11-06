// Locale-scope helper used by the AI scan. Copied from the retired regular scanner.
export function detectMarketPathPrefix(inputUrl: string): string | undefined {
  try {
    const url = new URL(inputUrl);
    const segments = url.pathname.split("/").filter(Boolean);
    const localeIndex = segments.findIndex((segment) =>
      /^[a-z]{2}(?:-[a-z]{2})?$/i.test(segment),
    );
    if (localeIndex >= 0) return `/${segments.slice(0, localeIndex + 1).join("/").toLowerCase()}`;
    return undefined;
  } catch {
    return undefined;
  }
}
