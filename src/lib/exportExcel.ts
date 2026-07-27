import ExcelJS from "exceljs";
import type {
  Project,
  SelectedComponent,
  SelectedTemplate,
  EstimationSummary,
} from "@/types";

const COBALT_HEX = "FF0029DA";
const SKY_BLUE_HEX = "FF0094FA";
const BG_BLUE_HEX = "FFF1F5F9";
const WHITE_HEX = "FFFFFFFF";
const LIGHT_GREY_HEX = "FF484A4B";
const STROKES_HEX = "FFD9D9D9";

function applyHeaderStyle(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COBALT_HEX },
    };
    cell.font = { bold: true, color: { argb: WHITE_HEX }, size: 11 };
    cell.alignment = { vertical: "middle", horizontal: "left" };
    cell.border = {
      bottom: { style: "thin", color: { argb: STROKES_HEX } },
    };
  });
}

function applyDataRowStyle(row: ExcelJS.Row, isEven: boolean) {
  row.eachCell((cell) => {
    cell.font = { size: 10 };
    cell.alignment = { vertical: "top", wrapText: true };
    if (isEven) {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: BG_BLUE_HEX },
      };
    }
    cell.border = {
      bottom: { style: "thin", color: { argb: STROKES_HEX } },
    };
  });
}

function applyGroupHeaderStyle(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: SKY_BLUE_HEX },
    };
    cell.font = { bold: true, color: { argb: WHITE_HEX }, size: 11 };
    cell.alignment = { vertical: "middle" };
  });
}

export async function exportExcel(
  project: Project,
  components: SelectedComponent[],
  templates: SelectedTemplate[],
  estimation: EstimationSummary
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Feasibly";
  workbook.created = new Date();

  // ── Summary Sheet ──
  const summarySheet = workbook.addWorksheet("Summary", {
    properties: { tabColor: { argb: COBALT_HEX } },
  });

  summarySheet.columns = [
    { width: 30 },
    { width: 30 },
    { width: 20 },
    { width: 20 },
  ];

  // Title
  const titleRow = summarySheet.addRow(["Feasibly — Project Estimation Report"]);
  titleRow.font = { bold: true, size: 18, color: { argb: COBALT_HEX } };
  summarySheet.mergeCells("A1:D1");
  summarySheet.addRow([]);

  // Project details
  const detailsHeaderRow = summarySheet.addRow(["Project Details"]);
  detailsHeaderRow.font = { bold: true, size: 14 };
  summarySheet.addRow(["Project Name", project.projectName || "—"]);
  summarySheet.addRow(["Live URL", project.liveUrl || "—"]);
  summarySheet.addRow([
    "Scope",
    [project.scope.components && "Components", project.scope.templates && "Templates"]
      .filter(Boolean)
      .join(", ") || "—",
  ]);
  summarySheet.addRow(["Platform", project.platform]);
  summarySheet.addRow([
    "Generated",
    new Date().toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  ]);
  summarySheet.addRow([]);

  // Estimation summary
  const estHeaderRow = summarySheet.addRow(["Estimation Summary"]);
  estHeaderRow.font = { bold: true, size: 14 };

  const statHeaders = summarySheet.addRow([
    "Metric",
    "Value",
    "With Buffer (20%)",
    "Weeks",
  ]);
  applyHeaderStyle(statHeaders);

  const statRows = [
    ["Total Components", estimation.totalComponents, "", ""],
    ["Total Variants", estimation.totalComponents, "", ""],
    ["Total Templates", estimation.totalTemplates, "", ""],
    ["Additional Pages", estimation.totalAdditionalPages, "", ""],
    [
      "Development Effort (days)",
      estimation.devDays,
      estimation.devDaysWithBuffer.toFixed(1),
      estimation.devWeeks,
    ],
    [
      "Design Effort (days)",
      estimation.designDays,
      estimation.designDaysWithBuffer.toFixed(1),
      estimation.designWeeks,
    ],
  ];

  statRows.forEach((data, i) => {
    const row = summarySheet.addRow(data);
    applyDataRowStyle(row, i % 2 === 0);
  });

  // ── Components Sheet ──
  const selectedComponents = components.filter((c) => c.isSelected);
  if (selectedComponents.length > 0) {
    const compSheet = workbook.addWorksheet("Components", {
      properties: { tabColor: { argb: SKY_BLUE_HEX } },
    });

    compSheet.columns = [
      { header: "Group", key: "group", width: 18 },
      { header: "Component", key: "name", width: 28 },
      { header: "Category", key: "category", width: 14 },
      { header: "Design Description", key: "designDescription", width: 40 },
      { header: "Development Description", key: "developmentDescription", width: 40 },
      { header: "Design Effort (h)", key: "designEffort", width: 16 },
      { header: "Dev Effort (h)", key: "devEffort", width: 14 },
      { header: "Assumptions", key: "assumptions", width: 30 },
    ];

    applyHeaderStyle(compSheet.getRow(1));

    // Group by group name
    const grouped = new Map<string, SelectedComponent[]>();
    for (const c of selectedComponents) {
      const group = c.group || "Other";
      if (!grouped.has(group)) grouped.set(group, []);
      grouped.get(group)!.push(c);
    }

    let rowIdx = 0;
    for (const [group, items] of grouped) {
      const groupRow = compSheet.addRow([group]);
      compSheet.mergeCells(
        `A${groupRow.number}:H${groupRow.number}`
      );
      applyGroupHeaderStyle(groupRow);

      for (const c of items) {
        const row = compSheet.addRow({
          group: "",
          name: c.name,
          category: c.category,
          designDescription: c.designDescription,
          developmentDescription: c.developmentDescription,
          designEffort: c.designEffort,
          devEffort: c.devEffort,
          assumptions: c.assumptions,
        });
        applyDataRowStyle(row, rowIdx % 2 === 0);
        rowIdx++;
      }
    }

    // Totals
    compSheet.addRow([]);
    const totalRow = compSheet.addRow([
      "",
      "TOTAL",
      "",
      "",
      "",
      selectedComponents.reduce((s, c) => s + c.designEffort, 0),
      selectedComponents.reduce((s, c) => s + c.devEffort, 0),
      "",
    ]);
    totalRow.font = { bold: true, size: 11 };
  }

  // ── Templates Sheet ──
  const selectedTemplates = templates.filter((t) => t.isSelected);
  if (selectedTemplates.length > 0) {
    const templSheet = workbook.addWorksheet("Templates", {
      properties: { tabColor: { argb: SKY_BLUE_HEX } },
    });

    templSheet.columns = [
      { header: "Template", key: "name", width: 28 },
      { header: "Category", key: "category", width: 14 },
      { header: "Description", key: "description", width: 40 },
      { header: "Design Effort Base (h)", key: "designEffortBase", width: 20 },
      { header: "Design Effort/Page (h)", key: "designEffortPerPage", width: 20 },
      { header: "Dev Effort Base (h)", key: "devEffortBase", width: 18 },
      { header: "Dev Effort/Page (h)", key: "devEffortPerPage", width: 18 },
      { header: "Additional Pages", key: "additionalPages", width: 16 },
      { header: "Total Design (h)", key: "totalDesign", width: 16 },
      { header: "Total Dev (h)", key: "totalDev", width: 14 },
    ];

    applyHeaderStyle(templSheet.getRow(1));

    selectedTemplates.forEach((t, i) => {
      const totalDesign = t.designEffortBase + t.additionalPages * t.designEffortPerPage;
      const totalDev = t.devEffortBase + t.additionalPages * t.devEffortPerPage;
      const row = templSheet.addRow({
        name: t.name,
        category: t.category,
        description: t.description,
        designEffortBase: t.designEffortBase,
        designEffortPerPage: t.designEffortPerPage,
        devEffortBase: t.devEffortBase,
        devEffortPerPage: t.devEffortPerPage,
        additionalPages: t.additionalPages,
        totalDesign,
        totalDev,
      });
      applyDataRowStyle(row, i % 2 === 0);
    });

    // Totals
    templSheet.addRow([]);
    const totalRow = templSheet.addRow([
      "TOTAL",
      "",
      "",
      selectedTemplates.reduce((s, t) => s + t.designEffortBase, 0),
      "",
      selectedTemplates.reduce((s, t) => s + t.devEffortBase, 0),
      "",
      selectedTemplates.reduce((s, t) => s + t.additionalPages, 0),
      selectedTemplates.reduce(
        (s, t) => s + t.designEffortBase + t.additionalPages * t.designEffortPerPage,
        0
      ),
      selectedTemplates.reduce(
        (s, t) => s + t.devEffortBase + t.additionalPages * t.devEffortPerPage,
        0
      ),
    ]);
    totalRow.font = { bold: true, size: 11 };
  }

  // ── Download ──
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(project.projectName || "feasibly-report").replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\s+/g, "-")}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
