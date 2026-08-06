import ExcelJS from "exceljs";
import { BRAND } from "@/lib/theme";
import type { Project, SelectedComponent, SelectedTemplate } from "@/types";
import type { ScanSliceState } from "@/lib/scanner/types";

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

  // ── Sheet 4: Failed Pages ──
  const failedSheet = workbook.addWorksheet("Failed Pages", {
    properties: { tabColor: { argb: BRAND.brandRed.argb } },
  });

  failedSheet.columns = [
    { key: "url", width: 50 },
    { key: "title", width: 30 },
    { key: "pageType", width: 14 },
    { key: "status", width: 14 },
    { key: "reason", width: 40 },
  ];

  const failedHeader = failedSheet.addRow({
    url: "Page URL",
    title: "Page Title",
    pageType: "Page Type",
    status: "HTTP Status",
    reason: "Reason",
  });
  headerStyle(failedHeader);

  // Pages that were fetched but returned a 4xx/5xx status
  const errorPages = scan.discoveredPages.filter((p) => p.status < 200 || p.status >= 300);

  // Pages that couldn't be fetched at all — extracted from warning strings
  const fetchFailureRe = /^fetch (.+) failed: (.+)$/;
  const skippedRe = /^skipped (.+): (.+)$/;
  interface FailedEntry { url: string; reason: string }
  const warningFailures: FailedEntry[] = [];
  for (const w of scan.warnings) {
    const fm = fetchFailureRe.exec(w);
    if (fm) { warningFailures.push({ url: fm[1]!, reason: fm[2]! }); continue; }
    const sm = skippedRe.exec(w);
    if (sm) warningFailures.push({ url: sm[1]!, reason: `skipped: ${sm[2]!}` });
  }

  let failedRowIdx = 0;
  for (const page of errorPages) {
    const row = failedSheet.addRow({
      url: page.url,
      title: page.title || "—",
      pageType: page.pageType,
      status: page.status,
      reason: httpStatusLabel(page.status),
    });
    dataStyle(row, failedRowIdx % 2 === 0);
    failedRowIdx++;
  }
  for (const entry of warningFailures) {
    const row = failedSheet.addRow({
      url: entry.url,
      title: "—",
      pageType: "—",
      status: "—",
      reason: entry.reason,
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
