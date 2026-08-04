import { crawlSite } from "@/lib/scanner/crawler";
import { assertPublicUrl } from "@/lib/scanner/urlGuard";

const target = process.argv[2] ?? "https://navigator.global/gb";

async function main() {
  const parsed = await assertPublicUrl(target);
  if (!parsed.ok || !parsed.url) {
    throw new Error(parsed.reason ?? "URL guard failed");
  }
  const url = parsed.url.toString();
  process.stderr.write(`Crawling ${url}\n`);

  const result = await crawlSite(url, {
    onProgress: (p) => {
      process.stderr.write(
        `  [${p.pagesScanned}/${p.pagesQueued}] ${p.currentUrl ?? ""}\n`,
      );
    },
  });

  const summary = {
    homeUrl: result.homeUrl,
    pagesCount: result.pages.length,
    warnings: result.warnings,
    pages: result.pages.map((p) => ({
      url: p.url,
      title: p.title,
      pageType: p.pageType,
      depth: p.depth,
      discoveredFrom: p.discoveredFrom,
      htmlBytes: result.pageHtml.get(p.url)?.length ?? 0,
    })),
  };

  process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
}

main().catch((err) => {
  process.stderr.write(`ERROR: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
