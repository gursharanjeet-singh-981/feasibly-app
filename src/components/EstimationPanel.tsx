"use client";

import { useMemo, useState } from "react";
import { useAppStore } from "@/store";
import { Button } from "@/components/ui/button";
import { SvgIcon } from "@/components/SvgIcon";
import {
  Download,
  FileSpreadsheet,
} from "lucide-react";

const BUFFER_MULTIPLIER = 1.2;
const DAYS_PER_WEEK = 5;

export function EstimationPanel() {
  const components = useAppStore((s) => s.components);
  const templates = useAppStore((s) => s.templates);
  const project = useAppStore((s) => s.project);
  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null);

  const estimation = useMemo(() => {
    const selectedComponents = components.filter((c) => c.isSelected);
    const selectedTemplates = templates.filter((t) => t.isSelected);

    const componentDesignDays = selectedComponents.reduce((sum, c) => sum + c.designEffort, 0);
    const componentDevDays = selectedComponents.reduce((sum, c) => sum + c.devEffort, 0);
    const templateDesignDays = selectedTemplates.reduce(
      (sum, t) => sum + t.designEffortBase + t.additionalPages * t.designEffortPerPage, 0
    );
    const templateDevDays = selectedTemplates.reduce(
      (sum, t) => sum + t.devEffortBase + t.additionalPages * t.devEffortPerPage, 0
    );

    const designDays = componentDesignDays + templateDesignDays;
    const devDays = componentDevDays + templateDevDays;
    const designDaysWithBuffer = designDays * BUFFER_MULTIPLIER;
    const devDaysWithBuffer = devDays * BUFFER_MULTIPLIER;

    return {
      totalComponents: selectedComponents.length,
      totalTemplates: selectedTemplates.length,
      totalAdditionalPages: selectedTemplates.reduce((sum, t) => sum + t.additionalPages, 0),
      designDays,
      designDaysWithBuffer,
      designWeeks: Math.ceil(designDaysWithBuffer / DAYS_PER_WEEK),
      devDays,
      devDaysWithBuffer,
      devWeeks: Math.ceil(devDaysWithBuffer / DAYS_PER_WEEK),
    };
  }, [components, templates]);

  const handleExportPDF = async () => {
    setExporting("pdf");
    try {
      const { exportPDF } = await import("@/lib/exportPdf");
      exportPDF(project, components, templates, estimation);
    } finally {
      setExporting(null);
    }
  };

  const handleExportExcel = async () => {
    setExporting("excel");
    try {
      const { exportExcel } = await import("@/lib/exportExcel");
      await exportExcel(project, components, templates, estimation);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="bg-[#e3e7ef] flex flex-col justify-between rounded-3xl lg:rounded-[60px] p-6 md:p-8 lg:p-10 w-full lg:w-[529px] shrink-0 h-full overflow-y-auto">
      <div className="flex flex-col gap-8 lg:gap-10">
        {/* Title */}
        <h2 className="text-2xl lg:text-[30px] font-semibold text-black">
          Your estimation
        </h2>

        {/* Summary Stats - Row 1 */}
        {project.scope.components && (
        <div className="grid grid-cols-2 gap-6 lg:gap-8">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <SvgIcon name="components" width={16} height={16} className="text-black" />
              <p className="text-sm lg:text-base font-bold text-black">
                Total Components
              </p>
            </div>
            <p className="text-xs text-light-grey-text">
              This is main category (ie: forms)
            </p>
            <p className="text-3xl lg:text-[40px] text-black">
              {estimation.totalComponents}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <SvgIcon name="graph" width={16} height={16} className="text-black" />
              <p className="text-sm lg:text-base font-bold text-black">
                Total Variants
              </p>
            </div>
            <p className="text-xs text-light-grey-text">
              This is the variants within a component
            </p>
            <p className="text-3xl lg:text-[40px] text-black">
              {estimation.totalComponents}
            </p>
          </div>
        </div>
        )}

        {/* Summary Stats - Row 2 */}
        {project.scope.templates && (
        <div className="grid grid-cols-2 gap-6 lg:gap-8">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <SvgIcon name="file-copy" width={16} height={16} className="text-black opacity-54" />
              <p className="text-sm lg:text-base font-bold text-black">
                Total Templates
              </p>
            </div>
            <p className="text-xs text-light-grey-text">
              Total amount of templates
            </p>
            <p className="text-3xl lg:text-[40px] text-black">
              {estimation.totalTemplates}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <SvgIcon name="add-to-queue" width={16} height={16} className="text-black opacity-54" />
              <p className="text-sm lg:text-base font-bold text-black">
                Additional Pages
              </p>
            </div>
            <p className="text-xs text-light-grey-text">
              Total amount of additional pages
            </p>
            <p className="text-3xl lg:text-[40px] text-black">
              {estimation.totalAdditionalPages}
            </p>
          </div>
        </div>
        )}

        {/* Development Card */}
        <div className="bg-white border border-strokes rounded-2xl lg:rounded-[40px] p-5">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-[30px] h-[30px] bg-cobalt rounded-lg">
                  <SvgIcon name="developer-mode" width={14} height={8} className="text-white" />
                </div>
                <p className="text-base font-bold text-black">Development</p>
              </div>
              <SvgIcon name="info" width={20} height={20} className="text-black opacity-54" />
            </div>
            <p className="text-3xl lg:text-[40px] text-black">
              {estimation.devDaysWithBuffer.toFixed(1)} days
            </p>
            <div className="flex items-center justify-between">
              <p className="text-lg text-black">{estimation.devWeeks} weeks</p>
              <p className="text-xs text-light-grey-text">
                Incl. 20% buffer time
              </p>
            </div>
            <p className="text-[10px] text-light-grey-text font-medium">
              Includes both Front-end &amp; Back-end
            </p>
          </div>
        </div>

        {/* Design Card */}
        <div className="bg-white border border-strokes rounded-2xl lg:rounded-[40px] p-5">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-[30px] h-[30px] bg-cobalt rounded-lg">
                  <SvgIcon name="pencil" width={14} height={14} className="text-white" />
                </div>
                <p className="text-base font-bold text-black">Design</p>
              </div>
              <SvgIcon name="info" width={20} height={20} className="text-black opacity-54" />
            </div>
            <p className="text-3xl lg:text-[40px] text-black">
              {estimation.designDaysWithBuffer.toFixed(1)} days
            </p>
            <div className="flex items-center justify-between">
              <p className="text-lg text-black">
                {estimation.designWeeks} weeks
              </p>
              <p className="text-xs text-light-grey-text">
                Incl. 20% buffer time
              </p>
            </div>
            <p className="text-[10px] text-light-grey-text font-medium">
              Includes both UX &amp; UI
            </p>
          </div>
        </div>
      </div>

      {/* Export Buttons */}
      <div className="flex flex-col gap-3 mt-8 lg:mt-10">
        <Button
          onClick={handleExportPDF}
          disabled={exporting !== null}
          className="h-12 md:h-14 lg:h-[60px] rounded-full bg-cobalt hover:bg-cobalt/90 text-white text-base w-full gap-2"
        >
          {exporting === "pdf" ? "Exporting…" : "Export PDF Report"}
          <Download className="w-5 h-5" />
        </Button>
        <Button
          onClick={handleExportExcel}
          disabled={exporting !== null}
          variant="outline"
          className="h-12 md:h-14 lg:h-[60px] rounded-full border-cobalt text-cobalt hover:bg-cobalt/10 text-base w-full gap-2"
        >
          {exporting === "excel" ? "Exporting…" : "Export Excel Report"}
          <FileSpreadsheet className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}
