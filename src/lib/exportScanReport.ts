import ExcelJS from "exceljs";
import { BRAND } from "@/lib/theme";
import type { Project, SelectedComponent, SelectedTemplate } from "@/types";
import type { DiscoveredPage, ScanSliceState } from "@/lib/scanner/types";

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
  const unmatchedComponents = scan.unmatched.filter((item) => item.kind === "component");
  const unmatchedTemplates = scan.unmatched.filter((item) => item.kind === "template");
  const failedEntries = buildFailedEntries(scan, pageByUrl);

  // Invert matchedComponentIds → pageUrl → components[]
  const pageComponents = new Map<string, { name: string; group: string; confidence: number }[]>();
  for (const [id, meta] of Object.entries(scan.matchedComponentIds)) {
    const comp = componentById.get(Number(id));
    if (!comp) continue;
    for (const url of meta.pages) {
      if (!pageComponents.has(url)) pageComponents.set(url, []);
      pageComponents.get(url)!.push({ name: comp.name, group: comp.group, confidence: meta.confidence });
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
  overviewSheet.addRow(["Pages Scanned", scan.pagesScanned]);
  overviewSheet.addRow(["Components Matched", Object.keys(scan.matchedComponentIds).length]);
  overviewSheet.addRow(["Templates Matched", Object.keys(scan.matchedTemplateIds).length]);
  overviewSheet.addRow(["Components Unmatched", unmatchedComponents.length]);
  overviewSheet.addRow(["Templates Unmatched", unmatchedTemplates.length]);
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

  // ── Sheet 2: Components by Page ──
  const compSheet = workbook.addWorksheet("Components by Page", {
    properties: { tabColor: { argb: SKY_BLUE } },
  });

  compSheet.columns = [
    { key: "url", width: 50 },
    { key: "title", width: 30 },
    { key: "pageType", width: 14 },
    { key: "group", width: 22 },
    { key: "name", width: 28 },
    { key: "confidence", width: 14 },
  ];

  const compHeader = compSheet.addRow({
    url: "Page URL",
    title: "Page Title",
    pageType: "Page Type",
    group: "Component Group",
    name: "Component Name",
    confidence: "Confidence",
  });
  headerStyle(compHeader);

  let compRowIdx = 0;
  for (const page of scan.discoveredPages) {
    const comps = pageComponents.get(page.url);
    if (!comps || comps.length === 0) continue;
    // Sort by confidence descending within a page
    const sorted = [...comps].sort((a, b) => b.confidence - a.confidence);
    for (const comp of sorted) {
      const row = compSheet.addRow({
        url: page.url,
        title: page.title || "—",
        pageType: page.pageType,
        group: comp.group,
        name: comp.name,
        confidence: `${Math.round(comp.confidence * 100)}%`,
      });
      dataStyle(row, compRowIdx % 2 === 0);
      compRowIdx++;
    }
  }

  if (compRowIdx === 0) {
    const row = compSheet.addRow({ url: "No components detected on any scanned page." });
    row.font = { italic: true, color: { argb: BRAND.lightGrey.argb } };
  }

  // ── Sheet 3: Templates by Page ──
  const tmplSheet = workbook.addWorksheet("Templates by Page", {
    properties: { tabColor: { argb: SKY_BLUE } },
  });

  tmplSheet.columns = [
    { key: "url", width: 50 },
    { key: "title", width: 30 },
    { key: "pageType", width: 14 },
    { key: "name", width: 36 },
    { key: "confidence", width: 14 },
  ];

  const tmplHeader = tmplSheet.addRow({
    url: "Page URL",
    title: "Page Title",
    pageType: "Page Type",
    name: "Template",
    confidence: "Confidence",
  });
  headerStyle(tmplHeader);

  let tmplRowIdx = 0;
  for (const page of scan.discoveredPages) {
    const tmpls = pageTemplates.get(page.url);
    if (!tmpls || tmpls.length === 0) continue;
    const sorted = [...tmpls].sort((a, b) => b.confidence - a.confidence);
    for (const tmpl of sorted) {
      const row = tmplSheet.addRow({
        url: page.url,
        title: page.title || "—",
        pageType: page.pageType,
        name: tmpl.name,
        confidence: `${Math.round(tmpl.confidence * 100)}%`,
      });
      dataStyle(row, tmplRowIdx % 2 === 0);
      tmplRowIdx++;
    }
  }

  if (tmplRowIdx === 0) {
    const row = tmplSheet.addRow({ url: "No templates detected on any scanned page." });
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

  // ── Sheet 5: Failed Pages ──
  const failedSheet = workbook.addWorksheet("Failed Pages", {
    properties: { tabColor: { argb: BRAND.brandRed.argb } },
  });

  failedSheet.columns = [
    { key: "url", width: 50 },
    { key: "title", width: 30 },
    { key: "pageType", width: 14 },
    { key: "status", width: 14 },
    { key: "category", width: 22 },
    { key: "reason", width: 40 },
    { key: "action", width: 42 },
    { key: "source", width: 16 },
  ];

  const failedHeader = failedSheet.addRow({
    url: "Page URL",
    title: "Page Title",
    pageType: "Page Type",
    status: "HTTP Status",
    category: "Issue Category",
    reason: "Reason",
    action: "Recommended Action",
    source: "Source",
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
      action: issue.action,
      source: issue.source,
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

function httpStatusLabel(status: number): string {
  const labels: Record<number, string> = {
    400: "Bad Request", 401: "Unauthorized", 403: "Forbidden",
    404: "Not Found", 408: "Request Timeout", 410: "Gone",
    429: "Too Many Requests", 500: "Internal Server Error",
    502: "Bad Gateway", 503: "Service Unavailable", 504: "Gateway Timeout",
  };
  return labels[status] ?? (status >= 400 && status < 500 ? "Client Error" : "Server Error");
}

interface FailedEntry {
  url: string;
  title: string;
  pageType: string;
  status: string | number;
  category: string;
  reason: string;
  action: string;
  source: "http_status" | "warning";
}

function buildFailedEntries(
  scan: ScanSliceState,
  pageByUrl: Map<string, DiscoveredPage>,
): FailedEntry[] {
  const entries: FailedEntry[] = [];

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

  const fetchFailureRe = /^fetch (.+) failed: (.+)$/;
  const skippedRe = /^skipped (.+): (.+)$/;
  const authPartialRe = /^auth_wall_partial:(\d+)$/;
  const timeoutRe = /^scan_timeout_after_(\d+)ms$/;

  for (const warning of scan.warnings) {
    const fetchMatch = fetchFailureRe.exec(warning);
    if (fetchMatch) {
      const url = fetchMatch[1]!;
      const reason = fetchMatch[2]!;
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

    const skippedMatch = skippedRe.exec(warning);
    if (skippedMatch) {
      const url = skippedMatch[1]!;
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
  if (normalized.includes("abort") || normalized.includes("timeout") || normalized.includes("timed out")) {
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
