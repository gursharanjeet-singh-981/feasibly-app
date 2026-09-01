import ExcelJS from "exceljs";
import { BRAND } from "@/lib/theme";
import type { Project, SelectedComponent, SelectedTemplate } from "@/types";
import type { DiscoveredPage, ScanSliceState, UnscannedPage } from "@/lib/scanner/types";

const COBALT = BRAND.cobalt.argb;
const SKY_BLUE = BRAND.skyBlue.argb;
const BG_BLUE = BRAND.bgBlue.argb;
const WHITE = BRAND.white.argb;
const STROKES = BRAND.strokes.argb;

function headerStyle(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COBALT } };
    cell.font = { bold: true, color: { argb: WHITE }, size: 11 };
    cell.alignment = { vertical: "middle", horizontal: "left" };
    cell.border = { bottom: { style: "thin", color: { argb: STROKES } } };
  });
}

function dataStyle(row: ExcelJS.Row, isEven: boolean) {
  row.eachCell((cell) => {
    cell.font = { size: 10 };
    cell.alignment = { vertical: "top", wrapText: true };
    if (isEven) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BG_BLUE } };
    }
    cell.border = { bottom: { style: "thin", color: { argb: STROKES } } };
  });
}

export function getDefaultScanSheetNames(): string[] {
  return ["Scan Overview", "Detected Components", "Templates", "Unmatched Items", "Issues"];
}

export async function exportScanReport(
  project: Project,
  scan: ScanSliceState,
  components: SelectedComponent[],
  templates: SelectedTemplate[],
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Feasibly";
  workbook.created = new Date();

  const componentById = new Map(components.map((c) => [c.id, c]));
  const templateById = new Map(templates.map((t) => [t.id, t]));
  const pageByUrl = new Map(scan.discoveredPages.map((p) => [p.url, p]));
  const coverageSummary = summarizeKnownUrlCoverage(scan);
  const scanCoverage = summarizeScanCoverage(scan);
  const unmatchedComponents = scan.unmatched.filter((item) => item.kind === "component");
  const unmatchedTemplates = scan.unmatched.filter((item) => item.kind === "template");
  const failedEntries = buildFailedEntries(scan, pageByUrl, project.liveUrl);

  // Invert matchedComponentIds → pageUrl → components[]
  const pageComponents = new Map<string, { variant: string; group: string; confidence: number; reason: string }[]>();
  for (const [id, meta] of Object.entries(scan.matchedComponentIds)) {
    const comp = componentById.get(Number(id));
    if (!comp) continue;
    for (const url of meta.pages) {
      if (!pageComponents.has(url)) pageComponents.set(url, []);
      pageComponents.get(url)!.push({
        variant: comp.name,
        group: comp.group,
        confidence: meta.confidence,
        reason: meta.reason ?? "Variant rationale was not recorded for this scan.",
      });
    }
  }

  // Invert matchedTemplateIds → pageUrl → templates[]
  const pageTemplates = new Map<string, { name: string; confidence: number }[]>();
  for (const [id, meta] of Object.entries(scan.matchedTemplateIds)) {
    const tmpl = templateById.get(Number(id));
    if (!tmpl) continue;
    for (const url of meta.pages) {
      if (!pageTemplates.has(url)) pageTemplates.set(url, []);
      pageTemplates.get(url)!.push({ name: tmpl.name, confidence: meta.confidence });
    }
  }

  // ── Sheet 1: Scan Overview ──
  const overviewSheet = workbook.addWorksheet("Scan Overview", {
    properties: { tabColor: { argb: COBALT } },
  });

  const titleRow = overviewSheet.addRow([`Feasibly — Scan Report: ${project.projectName || "—"}`]);
  titleRow.font = { bold: true, size: 16, color: { argb: COBALT } };
  overviewSheet.mergeCells("A1:G1");
  overviewSheet.addRow([]);

  overviewSheet.addRow(["Live URL", project.liveUrl || "—"]);
  overviewSheet.addRow([
    "Scan Date",
    new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
  ]);
  overviewSheet.addRow(["Components Matched", Object.keys(scan.matchedComponentIds).length]);
  overviewSheet.addRow(["Templates Matched", Object.keys(scan.matchedTemplateIds).length]);
  overviewSheet.addRow(["Components Unmatched", unmatchedComponents.length]);
  overviewSheet.addRow(["Templates Unmatched", unmatchedTemplates.length]);
  overviewSheet.addRow(["Known URLs", coverageSummary.known]);
  overviewSheet.addRow(["Known URLs Scanned", `${coverageSummary.scanned} (${coverageSummary.percentage}%)`]);
  overviewSheet.addRow(["URLs Selected for Scan", scanCoverage.selectedForScan]);
  overviewSheet.addRow(["Selected URLs Remaining", scanCoverage.selectedRemaining]);
  overviewSheet.addRow(["Pages With Scan Issues", failedEntries.length]);
  overviewSheet.addRow([]);

  overviewSheet.columns = [
    { key: "url", width: 50 },
    { key: "title", width: 30 },
    { key: "pageType", width: 14 },
    { key: "status", width: 10 },
    { key: "depth", width: 8 },
    { key: "components", width: 14 },
    { key: "templates", width: 14 },
  ];

  const overviewHeader = overviewSheet.addRow({
    url: "Page URL",
    title: "Page Title",
    pageType: "Page Type",
    status: "HTTP Status",
    depth: "Depth",
    components: "Components",
    templates: "Templates",
  });
  headerStyle(overviewHeader);

  scan.discoveredPages.forEach((page, i) => {
    const row = overviewSheet.addRow({
      url: page.url,
      title: page.title || "—",
      pageType: page.pageType,
      status: page.status,
      depth: page.depth,
      components: pageComponents.get(page.url)?.length ?? 0,
      templates: pageTemplates.get(page.url)?.length ?? 0,
    });
    dataStyle(row, i % 2 === 0);
  });

  // ── Sheet 2: Detected Components ──
  const compSheet = workbook.addWorksheet("Detected Components", {
    properties: { tabColor: { argb: SKY_BLUE } },
  });

  compSheet.columns = [
    { key: "group", width: 22 },
    { key: "variant", width: 34 },
    { key: "confidence", width: 14 },
    { key: "pageCount", width: 16 },
    { key: "pageUrls", width: 64 },
  ];

  const compHeader = compSheet.addRow({
    group: "Component Group",
    variant: "Variant Name",
    confidence: "Confidence",
    pageCount: "Detected on Pages",
    pageUrls: "Detected On URLs",
  });
  headerStyle(compHeader);

  const uniqueComponentEntries = buildUniqueComponentEntries(scan, components);
  uniqueComponentEntries.forEach((entry, index) => {
    dataStyle(compSheet.addRow(entry), index % 2 === 0);
  });
  if (uniqueComponentEntries.length === 0) {
    const row = compSheet.addRow({ group: "No components detected." });
    row.font = { italic: true, color: { argb: BRAND.lightGrey.argb } };
  }

  // ── Sheet 3: Templates ──
  const tmplSheet = workbook.addWorksheet("Templates", {
    properties: { tabColor: { argb: SKY_BLUE } },
  });

  const templateEntries = Object.entries(scan.matchedTemplateIds)
    .flatMap(([id, metadata]) => {
      const template = templateById.get(Number(id));
      if (!template) return [];
      const pages = [...new Set(metadata.pages)].sort();
      return [{
        name: template.name,
        confidence: `${Math.round(metadata.confidence * 100)}%`,
        pageCount: pages.length,
        pageUrls: pages.join("\n"),
      }];
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  tmplSheet.columns = [
    { key: "name", width: 36 },
    { key: "confidence", width: 14 },
    { key: "pageCount", width: 16 },
    { key: "pageUrls", width: 64 },
  ];

  const tmplHeader = tmplSheet.addRow({
    name: "Template",
    confidence: "Confidence",
    pageCount: "Detected on Pages",
    pageUrls: "Detected On URLs",
  });
  headerStyle(tmplHeader);

  templateEntries.forEach((entry, index) => {
    dataStyle(tmplSheet.addRow(entry), index % 2 === 0);
  });
  if (templateEntries.length === 0) {
    const row = tmplSheet.addRow({ name: "No templates detected." });
    row.font = { italic: true, color: { argb: BRAND.lightGrey.argb } };
  }

  // ── Sheet 4: Unmatched Items ──
  const unmatchedSheet = workbook.addWorksheet("Unmatched Items", {
    properties: { tabColor: { argb: BRAND.brandNavy.argb } },
  });

  unmatchedSheet.columns = [
    { key: "kind", width: 14 },
    { key: "label", width: 34 },
    { key: "confidence", width: 14 },
    { key: "pageCount", width: 12 },
    { key: "pageUrls", width: 64 },
    { key: "pageTitles", width: 40 },
    { key: "pageTypes", width: 20 },
  ];

  const unmatchedHeader = unmatchedSheet.addRow({
    kind: "Type",
    label: "Detected Name",
    confidence: "Confidence",
    pageCount: "Pages",
    pageUrls: "Detected On URLs",
    pageTitles: "Page Titles",
    pageTypes: "Page Types",
  });
  headerStyle(unmatchedHeader);

  let unmatchedRowIdx = 0;
  const sortedUnmatched = [...scan.unmatched].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return a.label.localeCompare(b.label);
  });

  for (const item of sortedUnmatched) {
    const pages = [...new Set(item.pages)];
    const pageTitles = pages
      .map((url) => pageByUrl.get(url)?.title)
      .filter((title): title is string => Boolean(title && title.trim().length > 0));
    const pageTypes = new Set<string>();
    for (const url of pages) {
      const pageType = pageByUrl.get(url)?.pageType;
      if (pageType) pageTypes.add(pageType);
    }

    const row = unmatchedSheet.addRow({
      kind: item.kind,
      label: item.label,
      confidence: `${Math.round(item.confidence * 100)}%`,
      pageCount: pages.length,
      pageUrls: pages.join("\n") || "—",
      pageTitles: pageTitles.length > 0 ? pageTitles.join("\n") : "—",
      pageTypes: pageTypes.size > 0 ? [...pageTypes].join(", ") : "—",
    });
    dataStyle(row, unmatchedRowIdx % 2 === 0);
    unmatchedRowIdx++;
  }

  if (unmatchedRowIdx === 0) {
    const row = unmatchedSheet.addRow({ kind: "No unmatched items detected." });
    row.font = { italic: true, color: { argb: BRAND.lightGrey.argb } };
  }

  // ── Sheet 5: Issues ──
  const failedSheet = workbook.addWorksheet("Issues", {
    properties: { tabColor: { argb: BRAND.brandRed.argb } },
  });

  failedSheet.columns = [
    { key: "url", width: 50 },
    { key: "title", width: 30 },
    { key: "pageType", width: 14 },
    { key: "status", width: 14 },
    { key: "category", width: 22 },
    { key: "reason", width: 56 },
  ];

  const failedHeader = failedSheet.addRow({
    url: "Page URL",
    title: "Page Title",
    pageType: "Page Type",
    status: "HTTP Status",
    category: "Issue Category",
    reason: "Reason",
  });
  headerStyle(failedHeader);

  let failedRowIdx = 0;
  for (const issue of failedEntries) {
    const row = failedSheet.addRow({
      url: issue.url,
      title: issue.title,
      pageType: issue.pageType,
      status: issue.status,
      category: issue.category,
      reason: issue.reason,
    });
    dataStyle(row, failedRowIdx % 2 === 0);
    failedRowIdx++;
  }

  if (failedRowIdx === 0) {
    const row = failedSheet.addRow({ url: "All pages were scanned successfully." });
    row.font = { italic: true, color: { argb: BRAND.lightGrey.argb } };
  }

  // ── Download ──
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeName = (project.projectName || "scan-report")
    .replace(/[^a-zA-Z0-9-_ ]/g, "")
    .replace(/\s+/g, "-");
  a.download = `${safeName}-scan-report.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface UnscannedReportEntry {
  url: string;
  source: "sitemap" | "link";
  reason: string;
  detail?: string;
  action: string;
}

export interface UniqueComponentReportEntry {
  group: string;
  variant: string;
  confidence: string;
  pageCount: number;
  pageUrls: string;
}

export function buildUniqueComponentEntries(
  scan: ScanSliceState,
  components: SelectedComponent[],
): UniqueComponentReportEntry[] {
  const componentById = new Map(components.map((component) => [component.id, component]));

  return Object.entries(scan.matchedComponentIds)
    .flatMap(([id, metadata]) => {
      const component = componentById.get(Number(id));
      if (!component) return [];
      const pages = [...new Set(metadata.pages)].sort();
      return [{
        group: component.group,
        variant: component.name,
        confidence: `${Math.round(metadata.confidence * 100)}%`,
        pageCount: pages.length,
        pageUrls: pages.join("\n"),
      }];
    })
    .sort((a, b) => a.group.localeCompare(b.group) || a.variant.localeCompare(b.variant));
}

export function summarizeKnownUrlCoverage(scan: ScanSliceState): {
  known: number;
  scanned: number;
  percentage: number;
} {
  const knownUrls = new Set([
    ...scan.sitemapUrls,
    ...scan.scrapedUrls,
    ...scan.unscannedPages.map((page) => page.url),
  ]);
  const scannedUrls = new Set(scan.scrapedUrls);
  const scanned = [...knownUrls].filter((url) => scannedUrls.has(url)).length;
  return {
    known: knownUrls.size,
    scanned,
    percentage: knownUrls.size === 0 ? 0 : Math.round((scanned / knownUrls.size) * 100),
  };
}

export function summarizeScanCoverage(scan: ScanSliceState): {
  sitemapUrls: number;
  selectedForScan: number;
  scanned: number;
  selectedRemaining: number;
  unscanned: number;
} {
  const sitemapUrls = new Set(scan.sitemapUrls);
  const representativeUrls = selectedUrlSet(scan);
  const scrapedUrls = new Set(scan.scrapedUrls);
  const knownUrls = new Set([...sitemapUrls, ...scrapedUrls, ...scan.unscannedPages.map((page) => page.url)]);
  const scanned = [...scrapedUrls].filter((url) => representativeUrls.size === 0 || representativeUrls.has(url)).length;

  return {
    sitemapUrls: sitemapUrls.size,
    selectedForScan: representativeUrls.size,
    scanned,
    selectedRemaining: [...representativeUrls].filter((url) => !scrapedUrls.has(url)).length,
    unscanned: [...knownUrls].filter((url) => !scrapedUrls.has(url)).length,
  };
}

const PRE_FETCH_SKIP_REASONS = new Set<UnscannedPage["reason"]>([
  "max_pages_limit",
  "representative_page",
  "max_depth",
  "robots_disallow",
  "path_template_limit",
]);

function selectedUrlSet(scan: ScanSliceState): Set<string> {
  const preFetchSkippedUrls = new Set(
    scan.unscannedPages
      .filter((page) => PRE_FETCH_SKIP_REASONS.has(page.reason))
      .map((page) => page.url),
  );

  return new Set(scan.representativeUrls.filter((url) => !preFetchSkippedUrls.has(url)));
}

export function buildUnscannedEntries(pages: UnscannedPage[]): UnscannedReportEntry[] {
  const byUrl = new Map<string, UnscannedPage>();
  for (const page of pages) {
    const existing = byUrl.get(page.url);
    if (!existing || page.source === "sitemap") byUrl.set(page.url, page);
  }

  return [...byUrl.values()]
    .sort((a, b) => a.url.localeCompare(b.url))
    .map((page) => ({ ...page, ...describeUnscannedReason(page.reason) }));
}

function describeUnscannedReason(reason: UnscannedPage["reason"]): {
  reason: string;
  action: string;
} {
  const descriptions: Record<UnscannedPage["reason"], { reason: string; action: string }> = {
    max_pages_limit: {
      reason: "Maximum scan page limit reached",
      action: "Run a narrower scan or increase the configured page limit.",
    },
    representative_page: {
      reason: "Represented by a similar or primary-locale page",
      action: "Review the representative URL in the technical detail if this route may use a distinct layout.",
    },
    max_depth: {
      reason: "Beyond the configured crawl depth",
      action: "Run a scan from a closer parent page or increase the crawl depth.",
    },
    robots_disallow: {
      reason: "Blocked by robots.txt",
      action: "Review the site's robots.txt rules if this page should be scannable.",
    },
    path_template_limit: {
      reason: "Similar page structure already sampled",
      action: "Review the sampled page or increase the similar-page limit.",
    },
    scan_incomplete: {
      reason: "Scan ended before this page was processed",
      action: "Retry the scan or use a narrower starting URL.",
    },
    fetch_failed: {
      reason: "Page request failed",
      action: "Review the technical detail, verify availability, and retry.",
    },
    unsupported_content: {
      reason: "Page did not return HTML",
      action: "Confirm this URL is a web page that returns HTML content.",
    },
  };
  return descriptions[reason];
}

function httpStatusLabel(status: number): string {
  const labels: Record<number, string> = {
    400: "Bad Request", 401: "Unauthorized", 403: "Forbidden",
    404: "Not Found", 408: "Request Timeout", 410: "Gone",
    429: "Too Many Requests", 500: "Internal Server Error",
    502: "Bad Gateway", 503: "Service Unavailable", 504: "Gateway Timeout",
  };
  return labels[status] ?? (status >= 400 && status < 500 ? "Client Error" : "Server Error");
}

export interface FailedEntry {
  url: string;
  title: string;
  pageType: string;
  status: string | number;
  category: string;
  reason: string;
  action?: string;
  source: "http_status" | "warning" | "unscanned";
}

export function buildFailedEntries(
  scan: ScanSliceState,
  pageByUrl: Map<string, DiscoveredPage>,
  liveUrl: string,
): FailedEntry[] {
  const entries: FailedEntry[] = [];
  const baseUrl = parseUrl(liveUrl);
  const unscannedUrls = new Set(scan.unscannedPages.map((page) => page.url));

  for (const page of buildUnscannedEntries(scan.unscannedPages)) {
    const discovered = pageByUrl.get(page.url);
    entries.push({
      url: page.url,
      title: discovered?.title || "—",
      pageType: discovered?.pageType || "—",
      status: discovered?.status ?? "—",
      category: "Unscanned Page",
      reason: page.reason,
      action: page.detail ? `${page.action} Technical detail: ${page.detail}` : page.action,
      source: "unscanned",
    });
  }

  for (const page of scan.discoveredPages) {
    if (page.status >= 200 && page.status < 300) continue;
    const classified = classifyStatus(page.status);
    entries.push({
      url: page.url,
      title: page.title || "—",
      pageType: page.pageType,
      status: page.status,
      category: classified.category,
      reason: classified.reason,
      action: classified.action,
      source: "http_status",
    });
  }

  const fetchFailureRe = /^fetch (.+?) failed: (.+)$/;
  const sitemapFailureRe = /^sitemap (.+?) failed: (.+)$/;
  const robotsFailureRe = /^robots\.txt fetch failed: (.+)$/;
  const skippedRe = /^skipped (.+): (.+)$/;
  const similarSkipRe = /^similar_skip (.+): (.+)$/;
  const sitemapSummaryRe = /^sitemap_skip_summary (.+): (\d+)$/;
  const authPartialRe = /^auth_wall_partial:(\d+)$/;
  const timeoutRe = /^scan_timeout_after_(\d+)ms$/;
  const noPagesRe = /^no_pages_fetched$/;
  const crawlAbortedRe = /^Crawl aborted$/;
  const cookieConsentRe = /^cookie_consent_detected:(.+)$/;
  const spaDetectedRe = /^spa_detected$/;
  const spaSuspectedRe = /^spa_suspected:(.+)$/;

  for (const warning of scan.warnings) {
    const robotsMatch = robotsFailureRe.exec(warning);
    if (robotsMatch) {
      const reason = robotsMatch[1]!.trim();
      const url = baseUrl ? new URL("/robots.txt", baseUrl).toString() : "robots.txt";
      const classified = classifyWarningReason(reason);
      entries.push({
        url,
        title: "robots.txt",
        pageType: "—",
        status: "—",
        category: classified.category,
        reason,
        action: classified.action,
        source: "warning",
      });
      continue;
    }

    const sitemapMatch = sitemapFailureRe.exec(warning);
    if (sitemapMatch) {
      const url = sitemapMatch[1]!.trim();
      const reason = sitemapMatch[2]!.trim();
      const page = pageByUrl.get(url);
      const classified = classifyWarningReason(reason);
      entries.push({
        url,
        title: page?.title || "—",
        pageType: page?.pageType || "—",
        status: "—",
        category: classified.category,
        reason,
        action: classified.action,
        source: "warning",
      });
      continue;
    }

    const fetchMatch = fetchFailureRe.exec(warning);
    if (fetchMatch) {
      const url = fetchMatch[1]!.trim();
      if (unscannedUrls.has(url)) continue;
      const rawReason = fetchMatch[2]!.trim();
      const reason = humanizeWarningReason(rawReason);
      const page = pageByUrl.get(url);
      const classified = classifyWarningReason(rawReason);
      entries.push({
        url,
        title: page?.title || "—",
        pageType: page?.pageType || "—",
        status: "—",
        category: classified.category,
        reason,
        action: classified.action,
        source: "warning",
      });
      continue;
    }

    const skippedMatch = skippedRe.exec(warning);
    if (skippedMatch) {
      const url = skippedMatch[1]!;
      if (unscannedUrls.has(url)) continue;
      const reason = skippedMatch[2]!;
      const page = pageByUrl.get(url);
      const classified = classifyWarningReason(reason);
      entries.push({
        url,
        title: page?.title || "—",
        pageType: page?.pageType || "—",
        status: "—",
        category: classified.category,
        reason: `skipped: ${reason}`,
        action: classified.action,
        source: "warning",
      });
      continue;
    }

    const similarSkipMatch = similarSkipRe.exec(warning);
    if (similarSkipMatch) {
      const url = similarSkipMatch[1]!.trim();
      if (unscannedUrls.has(url)) continue;
      const reason = similarSkipMatch[2]!.trim();
      const page = pageByUrl.get(url);
      const normalizedReason = reason.toLowerCase();
      const similarSkipReason =
        normalizedReason === "path_template_limit"
          ? "This page matches an existing route pattern and was intentionally skipped to keep the crawl focused."
          : normalizedReason === "representative_page"
            ? "This page was already represented by a higher-priority route and was intentionally skipped."
            : normalizedReason === "robots_disallow"
              ? "This page was skipped because the site blocks access to this route in robots.txt."
              : `Similar page skipped because ${reason}.`;

      entries.push({
        url,
        title: page?.title || "—",
        pageType: page?.pageType || "—",
        status: "—",
        category:
          normalizedReason === "path_template_limit" || normalizedReason === "representative_page"
            ? "Similar Page Skipped"
            : normalizedReason === "robots_disallow"
              ? "Route Blocked by Robots"
              : "Similar Page Skipped",
        reason: similarSkipReason,
        source: "warning",
      });
      continue;
    }

    const sitemapSummaryMatch = sitemapSummaryRe.exec(warning);
    if (sitemapSummaryMatch) {
      const reasonCode = sitemapSummaryMatch[1]!.trim();
      const count = sitemapSummaryMatch[2]!;
      const reason = summarizeSitemapSkipReason(reasonCode);
      entries.push({
        url: "—",
        title: "—",
        pageType: "—",
        status: "—",
        category: "Sitemap Coverage Gap",
        reason: `${count} sitemap URLs were skipped because ${reason}.`,
        action: "Review the sitemap and consider widening the crawl or removing duplicate/skipped routes.",
        source: "warning",
      });
      continue;
    }

    const authPartialMatch = authPartialRe.exec(warning);
    if (authPartialMatch) {
      const blockedCount = authPartialMatch[1]!;
      entries.push({
        url: "—",
        title: "—",
        pageType: "—",
        status: "—",
        category: "Authentication Required",
        reason: `${blockedCount} page(s) were blocked by login/authentication.`,
        action: "Use a public URL, or allow scanner access to authenticated pages.",
        source: "warning",
      });
      continue;
    }

    const timeoutMatch = timeoutRe.exec(warning);
    if (timeoutMatch) {
      const ms = timeoutMatch[1]!;
      entries.push({
        url: "—",
        title: "—",
        pageType: "—",
        status: "—",
        category: "Scan Timeout",
        reason: `Scan timed out after ${ms}ms.`,
        action: "Retry scan or reduce scan scope.",
        source: "warning",
      });
      continue;
    }

    if (noPagesRe.test(warning)) {
      entries.push({
        url: "—",
        title: "—",
        pageType: "—",
        status: "—",
        category: "No Pages Fetched",
        reason: "No pages were successfully fetched during the scan.",
        action: "Verify the live URL, robots rules, and public accessibility before retrying.",
        source: "warning",
      });
      continue;
    }

    if (crawlAbortedRe.test(warning)) {
      entries.push({
        url: "—",
        title: "—",
        pageType: "—",
        status: "—",
        category: "Scan Cancelled",
        reason: "Crawl aborted",
        action: "Retry the scan if you still need a complete report.",
        source: "warning",
      });
      continue;
    }

    const cookieConsentMatch = cookieConsentRe.exec(warning);
    if (cookieConsentMatch) {
      entries.push({
        url: cookieConsentMatch[1]!.trim(),
        title: "—",
        pageType: "—",
        status: "—",
        category: "Cookie Consent Detected",
        reason: "Cookie consent banner detected; additional interaction may be required to fully scan the site.",
        action: "Review the site flow and, if needed, run a scan with the consent experience enabled.",
        source: "warning",
      });
      continue;
    }

    if (spaDetectedRe.test(warning)) {
      entries.push({
        url: "—",
        title: "—",
        pageType: "—",
        status: "—",
        category: "Potential SPA / Thin Content",
        reason: "The site appears to be largely client-rendered or thin-content based.",
        action: "Check whether the site relies on client-side rendering and review the content structure.",
        source: "warning",
      });
      continue;
    }

    const spaSuspectedMatch = spaSuspectedRe.exec(warning);
    if (spaSuspectedMatch) {
      entries.push({
        url: spaSuspectedMatch[1]!.trim(),
        title: "—",
        pageType: "—",
        status: "—",
        category: "Potential SPA / Thin Content",
        reason: "Page content appears thin or client-rendered.",
        action: "Review the page structure and consider whether client-side rendering is affecting scan quality.",
        source: "warning",
      });
      continue;
    }
  }

  // De-duplicate repeated entries from mixed sources.
  const seen = new Set<string>();
  const deduped: FailedEntry[] = [];
  for (const entry of entries) {
    const key = [entry.url, entry.status, entry.category, entry.reason].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(entry);
  }

  return deduped;
}

function classifyStatus(status: number): {
  category: string;
  reason: string;
  action: string;
} {
  if (status === 401 || status === 403) {
    return {
      category: "Authentication Required",
      reason: `${status} ${httpStatusLabel(status)}`,
      action: "Use a public page URL or provide scanner access to protected pages.",
    };
  }
  if (status === 404 || status === 410) {
    return {
      category: "Page Not Reachable",
      reason: `${status} ${httpStatusLabel(status)}`,
      action: "Verify the page URL and sitemap links.",
    };
  }
  if (status === 429) {
    return {
      category: "Rate Limited",
      reason: `${status} ${httpStatusLabel(status)}`,
      action: "Retry later or reduce scan frequency.",
    };
  }
  if (status >= 500) {
    return {
      category: "Server Error",
      reason: `${status} ${httpStatusLabel(status)}`,
      action: "Check site health and retry the scan.",
    };
  }
  return {
    category: status >= 400 ? "Client Error" : "Unexpected Status",
    reason: `${status} ${httpStatusLabel(status)}`,
    action: "Review page availability and scanner access.",
  };
}

function classifyWarningReason(reason: string): {
  category: string;
  action: string;
} {
  const normalized = reason.toLowerCase();
  if (
    normalized.includes("unauthorized") ||
    normalized.includes("forbidden") ||
    normalized.includes("auth") ||
    normalized.includes("401") ||
    normalized.includes("403")
  ) {
    return {
      category: "Authentication Required",
      action: "Use a public URL or allow scanner access to authenticated pages.",
    };
  }
  if (normalized.includes("abort")) {
    return {
      category: "Scan Cancelled",
      action: "Retry the scan if you still need the report.",
    };
  }
  if (normalized.includes("timeout") || normalized.includes("timed out")) {
    return {
      category: "Timeout / Loading Issue",
      action: "Retry scan and verify page response time.",
    };
  }
  if (normalized.includes("content-type")) {
    return {
      category: "Unsupported Content",
      action: "Ensure the URL returns an HTML page.",
    };
  }
  if (normalized.includes("dns") || normalized.includes("enotfound") || normalized.includes("resolve")) {
    return {
      category: "DNS / Host Resolution",
      action: "Verify domain DNS and public accessibility.",
    };
  }
  if (normalized.includes("private_host") || normalized.includes("blocked_tld")) {
    return {
      category: "Security Restriction",
      action: "Use a public internet URL; private networks cannot be scanned.",
    };
  }
  if (normalized.includes("certificate") || normalized.includes("ssl") || normalized.includes("tls")) {
    return {
      category: "TLS / Certificate Issue",
      action: "Fix certificate configuration and retry.",
    };
  }
  return {
    category: "Fetch / Loading Issue",
    action: "Retry scan and inspect page/network availability.",
  };
}

function humanizeWarningReason(reason: string): string {
  const requestTimeout = /^request_timeout_after_(\d+)ms$/.exec(reason);
  if (requestTimeout) return `Request timed out after ${requestTimeout[1]}ms.`;
  const scanTimeout = /^scan_timeout_after_(\d+)ms$/.exec(reason);
  if (scanTimeout) return `Scan timed out after ${scanTimeout[1]}ms.`;
  if (reason === "scan_cancelled") return "The scan was cancelled before this request completed.";
  return reason;
}

function summarizeSitemapSkipReason(reasonCode: string): string {
  switch (reasonCode) {
    case "max_pages_limit":
      return "the maximum page limit was reached";
    case "robots_disallow":
      return "robots.txt blocked the route";
    case "scan_incomplete":
      return "the scan ended before the route was processed";
    case "representative_page":
      return "the page was already represented by a similar route";
    default:
      return `reason code ${reasonCode}`;
  }
}

function parseUrl(input: string): URL | null {
  try {
    return new URL(input);
  } catch {
    return null;
  }
}
