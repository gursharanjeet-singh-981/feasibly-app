const ExcelJS = require("exceljs");
const fs = require("fs");
const path = require("path");

async function convertExcel() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(
    path.resolve(__dirname, "../../FF - Data Set 1.xlsx")
  );

  // Components sheet
  const compSheet = wb.getWorksheet("Components");
  const components = [];
  let id = 1;

  for (let i = 3; i <= compSheet.rowCount; i++) {
    const row = compSheet.getRow(i);
    const name = row.getCell(2).value;
    const category = row.getCell(3).value;
    const variant = row.getCell(4).value;

    if (!variant && !name) continue;

    const designDesc = row.getCell(5).value || "";
    const devDesc = row.getCell(6).value || "";
    const designEffort = Number(row.getCell(7).value) || 0;
    const aiDesignEffort = Number(row.getCell(8).value) || 0;
    const devEffort = Number(row.getCell(9).value) || 0;
    const aiDevEffort = Number(row.getCell(10).value) || 0;
    const assumptions = row.getCell(11).value || "";

    components.push({
      id: id++,
      group: String(name || "").trim(),
      name: String(variant || name || "").trim(),
      category: String(category || "").trim(),
      designDescription: String(designDesc).trim(),
      developmentDescription: String(devDesc).trim(),
      designEffort,
      aiDesignEffort,
      devEffort,
      aiDevEffort,
      assumptions: String(assumptions).trim(),
    });
  }

  // Templates sheet
  const tmplSheet = wb.getWorksheet("Templates");
  const templates = [];
  let tmplId = 1;

  // Data starts at row 4 (row 1 = header group, row 2 = note, row 3 = column names)
  // Col 2: Template name, Col 3: Category, Col 4: Description
  // Col 5: Design Effort, Col 7: Extra Design per page
  // Col 8: Dev Effort (BE+FE), Col 10: Extra Dev per page
  for (let i = 4; i <= tmplSheet.rowCount; i++) {
    const row = tmplSheet.getRow(i);
    const name = row.getCell(2).value;

    if (!name) continue;

    const category = row.getCell(3).value || "";
    const description = row.getCell(4).value || "";
    const designEffortBase = Number(row.getCell(5).value) || 0;
    const aiDesignEffortBase = Number(row.getCell(6).value) || 0;
    const designEffortPerPage = Number(row.getCell(7).value) || 0;
    const devEffortBase = Number(row.getCell(8).value) || 0;
    const aiDevEffortBase = Number(row.getCell(9).value) || 0;
    const devEffortPerPage = Number(row.getCell(10).value) || 0;

    templates.push({
      id: tmplId++,
      name: String(name).trim(),
      category: String(category).trim(),
      description: String(description).trim(),
      designEffortBase,
      aiDesignEffortBase,
      designEffortPerPage,
      devEffortBase,
      aiDevEffortBase,
      devEffortPerPage,
    });
  }

  // Write output
  const outDir = path.resolve(__dirname, "../public/data");
  fs.mkdirSync(outDir, { recursive: true });

  fs.writeFileSync(
    path.join(outDir, "components.json"),
    JSON.stringify(components, null, 2)
  );
  fs.writeFileSync(
    path.join(outDir, "templates.json"),
    JSON.stringify(templates, null, 2)
  );

  // Global Principles sheet
  const gpSheet = wb.getWorksheet("Global Principles");
  const globalPrinciples = [];
  let gpId = 1;

  // Row 2 = headers, Row 3 = note, Row 4+ = data
  // Col 2: Global Parameter, Col 3: Design Description, Col 4: Development Description
  for (let i = 4; i <= gpSheet.rowCount; i++) {
    const row = gpSheet.getRow(i);
    const name = row.getCell(2).value;

    if (name == null || String(name).trim() === "") continue;

    const designDescription = row.getCell(3).value || "";
    const developmentDescription = row.getCell(4).value || "";

    globalPrinciples.push({
      id: gpId++,
      name: String(name).trim(),
      designDescription: String(designDescription).trim(),
      developmentDescription: String(developmentDescription).trim(),
    });
  }

  fs.writeFileSync(
    path.join(outDir, "global-principles.json"),
    JSON.stringify(globalPrinciples, null, 2)
  );

  console.log(`✅ Exported ${components.length} components`);
  console.log(`✅ Exported ${templates.length} templates`);
  console.log(`✅ Exported ${globalPrinciples.length} global principles`);
}

convertExcel().catch(console.error);
