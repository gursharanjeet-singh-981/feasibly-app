import jsPDF from "jspdf";
import type {
  Project,
  SelectedComponent,
  SelectedTemplate,
  EstimationSummary,
} from "@/types";
import { BRAND } from "@/lib/theme";
import { BUFFER_LABEL } from "@/lib/constants";

const COBALT = BRAND.cobalt.rgb;
const LIGHT_GREY = BRAND.lightGrey.rgb;
const STROKES = BRAND.strokes.rgb;
const BG_BLUE = BRAND.bgBlue.rgb;
const WHITE = BRAND.white.rgb;
const BLACK = BRAND.black.rgb;

type RGB = readonly [number, number, number];

function setColor(doc: jsPDF, color: RGB) {
  doc.setTextColor(color[0], color[1], color[2]);
}

function setFillColor(doc: jsPDF, color: RGB) {
  doc.setFillColor(color[0], color[1], color[2]);
}

function setDrawColor(doc: jsPDF, color: RGB) {
  doc.setDrawColor(color[0], color[1], color[2]);
}

function addPage(doc: jsPDF): number {
  doc.addPage();
  return 30;
}

function checkPageBreak(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > doc.internal.pageSize.getHeight() - 20) {
    return addPage(doc);
  }
  return y;
}

interface Cell {
  text: string;
  width: number;
}

const LINE_HEIGHT = 4;
const ROW_VPAD = 2;

// jsPDF's built-in Helvetica is WinAnsi-only; substitute common Unicode punctuation.
function sanitize(text: string): string {
  return text
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2212]/g, "-")
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ");
}

function drawTableRow(
  doc: jsPDF,
  cells: Cell[],
  x: number,
  y: number,
  contentWidth: number,
): number {
  const wrapped = cells.map((c) => {
    const lines = doc.splitTextToSize(sanitize(c.text), c.width - 4);
    return Array.isArray(lines) ? lines : [lines];
  });
  const maxLines = Math.max(1, ...wrapped.map((w) => w.length));
  const rowHeight = maxLines * LINE_HEIGHT + ROW_VPAD;

  let cx = x;
  for (let i = 0; i < cells.length; i++) {
    const lines = wrapped[i];
    for (let li = 0; li < lines.length; li++) {
      doc.text(lines[li], cx + 2, y + li * LINE_HEIGHT);
    }
    cx += cells[i].width;
  }

  const lineY = y + rowHeight - ROW_VPAD;
  setDrawColor(doc, STROKES);
  doc.line(x, lineY, x + contentWidth, lineY);
  return y + rowHeight;
}

export function exportPDF(
  project: Project,
  components: SelectedComponent[],
  templates: SelectedTemplate[],
  estimation: EstimationSummary
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  // ── Cover / Title Section ──
  setFillColor(doc, COBALT);
  doc.rect(0, 0, pageWidth, 80, "F");

  doc.setFontSize(28);
  setColor(doc, WHITE);
  doc.setFont("helvetica", "bold");
  doc.text("Feasibly", margin, 35);

  doc.setFontSize(10);
  doc.text("a Merkle tool", margin, 43);

  doc.setFontSize(16);
  doc.text("Project Estimation Report", margin, 60);

  doc.setFontSize(11);
  doc.text(sanitize(project.projectName || "Untitled Project"), margin, 70);

  // ── Project Info ──
  let y = 95;
  doc.setFontSize(14);
  setColor(doc, BLACK);
  doc.setFont("helvetica", "bold");
  doc.text("Project Details", margin, y);
  y += 10;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  setColor(doc, LIGHT_GREY);

  const details = [
    ["Project Name", project.projectName || "-"],
    ["Live URL", project.liveUrl || "-"],
    ["Scope", [project.scope.components && "Components", project.scope.templates && "Templates"].filter(Boolean).join(", ") || "-"],
    ["Platform", project.platform],
    ["Generated", new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })],
  ];

  for (const [label, value] of details) {
    setColor(doc, LIGHT_GREY);
    doc.text(label + ":", margin, y);
    setColor(doc, BLACK);
    doc.text(sanitize(String(value)), margin + 40, y);
    y += 7;
  }

  // ── Estimation Summary ──
  y += 8;
  doc.setFontSize(14);
  setColor(doc, BLACK);
  doc.setFont("helvetica", "bold");
  doc.text("Estimation Summary", margin, y);
  y += 10;

  // Summary cards
  const cardWidth = (contentWidth - 10) / 2;
  const cardHeight = 40;

  // Development card
  setFillColor(doc, BG_BLUE);
  doc.roundedRect(margin, y, cardWidth, cardHeight, 4, 4, "F");
  setFillColor(doc, COBALT);
  doc.roundedRect(margin + 5, y + 6, 8, 8, 2, 2, "F");
  doc.setFontSize(6);
  setColor(doc, WHITE);
  doc.setFont("helvetica", "bold");
  doc.text("DEV", margin + 5.5, y + 11);

  doc.setFontSize(10);
  setColor(doc, BLACK);
  doc.setFont("helvetica", "bold");
  doc.text("Development", margin + 17, y + 12);

  doc.setFontSize(18);
  doc.text(`${estimation.devDaysWithBuffer.toFixed(1)} days`, margin + 5, y + 26);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`${estimation.devWeeks} weeks`, margin + 5, y + 33);
  setColor(doc, LIGHT_GREY);
  doc.setFontSize(7);
  doc.text(BUFFER_LABEL, margin + cardWidth - 35, y + 33);

  // Design card
  const cardX2 = margin + cardWidth + 10;
  setFillColor(doc, BG_BLUE);
  doc.roundedRect(cardX2, y, cardWidth, cardHeight, 4, 4, "F");
  setFillColor(doc, COBALT);
  doc.roundedRect(cardX2 + 5, y + 6, 8, 8, 2, 2, "F");
  doc.setFontSize(6);
  setColor(doc, WHITE);
  doc.setFont("helvetica", "bold");
  doc.text("UX", cardX2 + 6, y + 11);

  doc.setFontSize(10);
  setColor(doc, BLACK);
  doc.setFont("helvetica", "bold");
  doc.text("Design", cardX2 + 17, y + 12);

  doc.setFontSize(18);
  doc.text(`${estimation.designDaysWithBuffer.toFixed(1)} days`, cardX2 + 5, y + 26);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`${estimation.designWeeks} weeks`, cardX2 + 5, y + 33);
  setColor(doc, LIGHT_GREY);
  doc.setFontSize(7);
  doc.text(BUFFER_LABEL, cardX2 + cardWidth - 35, y + 33);

  y += cardHeight + 10;

  // Stats row
  const stats = [
    { label: "Total Components", value: String(estimation.totalComponents) },
    { label: "Total Variants", value: String(estimation.totalVariants) },
    { label: "Total Templates", value: String(estimation.totalTemplates) },
    { label: "Additional Pages", value: String(estimation.totalAdditionalPages) },
  ];
  const statWidth = contentWidth / 4;
  for (let i = 0; i < stats.length; i++) {
    const sx = margin + i * statWidth;
    doc.setFontSize(8);
    setColor(doc, LIGHT_GREY);
    doc.text(stats[i].label, sx, y);
    doc.setFontSize(16);
    setColor(doc, BLACK);
    doc.setFont("helvetica", "bold");
    doc.text(stats[i].value, sx, y + 8);
  }
  y += 18;

  // ── Selected Components Table ──
  const selectedComponents = components.filter((c) => c.isSelected);
  if (selectedComponents.length > 0) {
    y = checkPageBreak(doc, y, 30);
    doc.setFontSize(14);
    setColor(doc, BLACK);
    doc.setFont("helvetica", "bold");
    doc.text("Selected Components", margin, y);
    y += 8;

    // Table header
    const colWidths = [55, 25, 45, 45];
    const headers = ["Component", "Category", "Design Effort", "Dev Effort"];
    setFillColor(doc, BG_BLUE);
    doc.rect(margin, y - 4, contentWidth, 8, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    setColor(doc, BLACK);
    let cx = margin + 2;
    for (let i = 0; i < headers.length; i++) {
      doc.text(headers[i], cx, y);
      cx += colWidths[i];
    }
    y += 7;

    // Table rows
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);

    // Group by group name
    const grouped = new Map<string, SelectedComponent[]>();
    for (const c of selectedComponents) {
      const group = c.group || "Other";
      if (!grouped.has(group)) grouped.set(group, []);
      grouped.get(group)!.push(c);
    }

    for (const [group, items] of grouped) {
      y = checkPageBreak(doc, y, 12);
      doc.setFont("helvetica", "bold");
      setColor(doc, COBALT);
      doc.text(group, margin + 2, y);
      y += 5;

      doc.setFont("helvetica", "normal");
      setColor(doc, BLACK);
      for (const c of items) {
        y = checkPageBreak(doc, y, 12);
        y = drawTableRow(
          doc,
          [
            { text: c.name, width: colWidths[0] },
            { text: c.category, width: colWidths[1] },
            { text: `${c.designEffort}h`, width: colWidths[2] },
            { text: `${c.devEffort}h`, width: colWidths[3] },
          ],
          margin,
          y,
          contentWidth,
        );
      }
      y += 2;
    }
  }

  // ── Selected Templates Table ──
  const selectedTemplates = templates.filter((t) => t.isSelected);
  if (selectedTemplates.length > 0) {
    y = checkPageBreak(doc, y, 30);
    y += 5;
    doc.setFontSize(14);
    setColor(doc, BLACK);
    doc.setFont("helvetica", "bold");
    doc.text("Selected Templates", margin, y);
    y += 8;

    const tColWidths = [45, 22, 28, 28, 28, 22];
    const tHeaders = ["Template", "Category", "Design", "Dev", "Extra/pg (D+D)", "Add. Pages"];
    setFillColor(doc, BG_BLUE);
    doc.rect(margin, y - 4, contentWidth, 8, "F");
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    setColor(doc, BLACK);
    let tx = margin + 2;
    for (let i = 0; i < tHeaders.length; i++) {
      doc.text(tHeaders[i], tx, y);
      tx += tColWidths[i];
    }
    y += 7;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    for (const t of selectedTemplates) {
      y = checkPageBreak(doc, y, 12);
      const templateLabel = t.description && t.description !== t.name
        ? `${t.name} - ${t.description}`
        : t.name;
      y = drawTableRow(
        doc,
        [
          { text: templateLabel, width: tColWidths[0] },
          { text: t.category, width: tColWidths[1] },
          { text: `${t.designEffortBase}h`, width: tColWidths[2] },
          { text: `${t.devEffortBase}h`, width: tColWidths[3] },
          {
            text: `${t.designEffortPerPage}h + ${t.devEffortPerPage}h`,
            width: tColWidths[4],
          },
          { text: String(t.additionalPages), width: tColWidths[5] },
        ],
        margin,
        y,
        contentWidth,
      );
    }
  }

  // ── Footer ──
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    setColor(doc, LIGHT_GREY);
    doc.text(
      `Feasibly - ${sanitize(project.projectName || "Project")} | Page ${i} of ${pageCount}`,
      margin,
      doc.internal.pageSize.getHeight() - 10
    );
  }

  const filename = `${(project.projectName || "feasibly-report").replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\s+/g, "-")}.pdf`;
  doc.save(filename);
}
