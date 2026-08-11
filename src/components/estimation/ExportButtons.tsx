"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TOAST_DURATION_MS, SCAN_FEATURE_ENABLED, SCAN_SINGLE_PAGE_OPTION_ENABLED } from "@/lib/constants";
import { useAppStore } from "@/store";
import type {
  Project,
  SelectedComponent,
  SelectedTemplate,
  EstimationSummary,
} from "@/types";

type Kind = "pdf" | "excel" | "scan";
type Message = { type: "success" | "error"; text: string } | null;

interface Props {
  project: Project;
  components: SelectedComponent[];
  templates: SelectedTemplate[];
  estimation: EstimationSummary;
  useAi: boolean;
}

export function ExportButtons({
  project,
  components,
  templates,
  estimation,
  useAi,
}: Props) {
  const [exporting, setExporting] = useState<Kind | null>(null);
  const [message, setMessage] = useState<Message>(null);
  const scan = useAppStore((s) => s.scan);
  const hasScanData = scan.status === "complete" && scan.pagesScanned > 0;

  const notify = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), TOAST_DURATION_MS);
  };

  const runExport = async (
    kind: Kind,
    action: () => Promise<void> | void,
    successText: string,
    errorText: string,
  ) => {
    setExporting(kind);
    try {
      await action();
      notify("success", successText);
    } catch {
      notify("error", errorText);
    } finally {
      setExporting(null);
    }
  };

  const handlePdf = () =>
    runExport(
      "pdf",
      async () => {
        const { exportPDF } = await import("@/lib/exportPdf");
        exportPDF(project, components, templates, estimation, useAi);
      },
      "PDF report exported successfully!",
      "Failed to export PDF report. Please try again.",
    );

  const handleExcel = () =>
    runExport(
      "excel",
      async () => {
        const { exportExcel } = await import("@/lib/exportExcel");
        await exportExcel(project, components, templates, estimation, useAi);
      },
      "Excel report exported successfully!",
      "Failed to export Excel report. Please try again.",
    );

  const handleScanReport = () =>
    runExport(
      "scan",
      async () => {
        const { exportScanReport } = await import("@/lib/exportScanReport");
        await exportScanReport(project, scan, components, templates);
      },
      "Scan report exported successfully!",
      "Failed to export scan report. Please try again.",
    );

  return (
    <div className="mt-8 lg:mt-10 flex flex-col gap-3">
      {message && (
        <div
          role="status"
          className={`text-center text-sm py-2 px-4 rounded-full ${
            message.type === "success"
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}
      <Button
        onClick={handlePdf}
        disabled={exporting !== null}
        className="h-12 md:h-14 lg:h-15 rounded-full bg-cobalt hover:bg-cobalt/90 text-white text-base w-full gap-2"
      >
        {exporting === "pdf" ? "Exporting…" : "Export PDF Report"}
        <Download className="w-5 h-5" />
      </Button>
      <Button
        onClick={handleExcel}
        disabled={exporting !== null}
        className="h-12 md:h-14 lg:h-15 rounded-full bg-white border border-cobalt text-cobalt hover:bg-cobalt/5 text-base w-full gap-2"
      >
        {exporting === "excel" ? "Exporting…" : "Export Excel Report"}
        <Download className="w-5 h-5" />
      </Button>
      {SCAN_FEATURE_ENABLED && SCAN_SINGLE_PAGE_OPTION_ENABLED && hasScanData && (
        <Button
          onClick={handleScanReport}
          disabled={exporting !== null}
          className="h-12 md:h-14 lg:h-15 rounded-full bg-white border border-cobalt text-cobalt hover:bg-cobalt/5 text-base w-full gap-2"
        >
          {exporting === "scan" ? "Exporting…" : "Export Scan Report"}
          <Download className="w-5 h-5" />
        </Button>
      )}
    </div>
  );
}
