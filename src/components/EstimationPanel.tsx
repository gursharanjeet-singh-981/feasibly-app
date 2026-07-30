"use client";

import { useMemo, useState } from "react";
import { useAppStore } from "@/store";
import { Button } from "@/components/ui/button";
import { SvgIcon } from "@/components/SvgIcon";
import { Download, X } from "lucide-react";

const BUFFER_MULTIPLIER = 1.2;
const DAYS_PER_WEEK = 5;

const DEV_INCLUDED = [
  { title: "Engineering Analysis & Planning", items: ["Reviewing design documentation", "Understanding migration constraints", "Mapping to core components or deciding on custom build", "Authoring model definition", "Technical feasibility notes", "Task breakdown & estimation"] },
  { title: "Pure Coding / Component Build", items: ["Backend AEM component implementation (HTL, Sling Models, dialogs)", "Front-end implementation (HTML, CSS, JS per component)", "Data layer wiring / analytics hooks", "Localisation support if needed", "Responsive behaviour implementation", "Reusable logic development (if part of system design)"] },
  { title: "Engineering Documentation", items: ["Authoring documentation (how authors use the component)", "Technical documentation (dependencies, logic, architecture)", "Notes in UAT"] },
  { title: "Manual Developer Testing", items: ["Unit tests", "Manual testing on breakpoints", "Checking alignment with design", "Browser testing", "Accessibility spot checks"] },
  { title: "Code Review Process", items: ["Peer review", "Corrections and improvements", "Security and performance checks"] },
  { title: "Build, Deploy & Release Activities", items: ["Integration into AEM environment", "Deployment pipeline steps", "Fixing environment configuration issues", "Release notes and artefacts"] },
];

const DESIGN_INCLUDED = [
  { title: "Product & UX Discovery Activities", items: ["Requirements clarification", "Understanding constraints of AEM templating & authoring", "Reviewing existing components for migration impact", "Accessibility considerations from the start"] },
  { title: "UX Design", items: ["Initial wireframes or structural patterns", "UX flows especially for interactive components like tabs, forms, nav, carousel", "Interaction principles", "Responsive rules (mobile, tablet, desktop behaviour)", "Edge cases and error states"] },
  { title: "UI Design", items: ["Applying brand visual styling", "Component variants (sizes, states, themes)", "Hover, active, focus states", "Motion guidance (if applicable)", "Asset creation (icons, imagery guidance)"] },
  { title: "Design System Alignment", items: ["Mapping patterns to the design system", "Creating new design tokens if needed", "Documenting rules for future reuse", "Ensuring consistency across components"] },
  { title: "Code Review Process", items: ["Peer review", "Corrections and improvements", "Security and performance checks"] },
  { title: "Documentation", items: ["Figma organisation", "Developer-ready annotation", "Final screens for all variants", "Accessibility specs", "Exporting assets where needed", "Preparation of component specification documentation"] },
];

export function EstimationPanel() {
  const components = useAppStore((s) => s.components);
  const templates = useAppStore((s) => s.templates);
  const project = useAppStore((s) => s.project);
  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null);
  const [infoSidebar, setInfoSidebar] = useState<"dev" | "design" | null>(null);

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



  return (
    <div className="bg-[#e3e7ef] flex flex-col justify-between rounded-3xl lg:rounded-[60px] p-6 md:p-8 lg:p-10 w-full h-full overflow-y-auto">
      <div className="flex flex-col gap-8 lg:gap-10">
        {/* Title + Stats */}
        <div className="flex flex-col gap-[30px]">
          <h2 className="text-2xl lg:text-[30px] font-semibold text-black">
            Your estimation
          </h2>

          {/* Stats Row 1: Components */}
          {project.scope.components && (
            <div className="flex gap-[30px] items-start">
              <div className="flex flex-col gap-[10px]">
                <div className="flex items-center gap-1.5">
                  <SvgIcon name="components" width={16} height={16} className="text-black" />
                  <p className="text-sm lg:text-base font-bold text-black">
                    Total Components
                  </p>
                </div>
                <p className="text-[10px] text-light-grey-text font-medium">
                  This is main category (ie: forms)
                </p>
                <p className="text-3xl lg:text-[40px] text-black">
                  {estimation.totalComponents}
                </p>
              </div>

              <div className="w-px h-[73px] bg-[#d9d9d9] self-center shrink-0" />

              <div className="flex flex-col gap-[10px]">
                <div className="flex items-center gap-1.5">
                  <SvgIcon name="graph" width={16} height={16} className="text-black" />
                  <p className="text-sm lg:text-base font-bold text-black">
                    Total Variants
                  </p>
                </div>
                <p className="text-[10px] text-light-grey-text font-medium">
                  This is the variants within a component
                </p>
                <p className="text-3xl lg:text-[40px] text-black">
                  {estimation.totalComponents}
                </p>
              </div>
            </div>
          )}

          {/* Stats Row 2: Templates */}
          {project.scope.templates && (
            <div className="flex gap-[30px] items-start">
              <div className="flex flex-col gap-[10px]">
                <div className="flex items-center gap-1.5">
                  <SvgIcon name="file-copy" width={16} height={16} className="text-black opacity-54" />
                  <p className="text-sm lg:text-base font-bold text-black">
                    Total Templates
                  </p>
                </div>
                <p className="text-[10px] text-light-grey-text font-medium">
                  Total amount of templates
                </p>
                <p className="text-3xl lg:text-[40px] text-black">
                  {estimation.totalTemplates}
                </p>
              </div>

              <div className="w-px h-[73px] bg-[#d9d9d9] self-center shrink-0" />

              <div className="flex flex-col gap-[10px]">
                <div className="flex items-center gap-1.5">
                  <SvgIcon name="add-to-queue" width={16} height={16} className="text-black opacity-54" />
                  <p className="text-sm lg:text-base font-bold text-black">
                    Additional Pages
                  </p>
                </div>
                <p className="text-[10px] text-light-grey-text font-medium">
                  Total amount of additional pages
                </p>
                <p className="text-3xl lg:text-[40px] text-black">
                  {estimation.totalAdditionalPages}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Development Card */}
        <div className="bg-white border-b border-r border-strokes rounded-2xl lg:rounded-[40px] p-5">
          <div className="flex flex-col gap-[11px]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-[30px] h-[30px] bg-cobalt rounded-lg">
                  <SvgIcon name="developer-mode" width={14} height={8} className="text-white" />
                </div>
                <p className="text-base font-bold text-black">Development</p>
              </div>
              <button onClick={() => setInfoSidebar("dev")} className="cursor-pointer">
                <SvgIcon name="info" width={20} height={20} className="text-black opacity-54" />
              </button>
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
        <div className="bg-white border-b border-r border-strokes rounded-2xl lg:rounded-[40px] p-5">
          <div className="flex flex-col gap-[11px]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-[30px] h-[30px] bg-cobalt rounded-lg">
                  <SvgIcon name="pencil" width={14} height={14} className="text-white" />
                </div>
                <p className="text-base font-bold text-black">Design</p>
              </div>
              <button onClick={() => setInfoSidebar("design")} className="cursor-pointer">
                <SvgIcon name="info" width={20} height={20} className="text-black opacity-54" />
              </button>
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

      {/* Export Button */}
      <div className="mt-8 lg:mt-10">
        <Button
          onClick={handleExportPDF}
          disabled={exporting !== null}
          className="h-12 md:h-14 lg:h-[60px] rounded-full bg-cobalt hover:bg-cobalt/90 text-white text-base w-full gap-2"
        >
          {exporting === "pdf" ? "Exporting…" : "Export PDF Report"}
          <Download className="w-5 h-5" />
        </Button>
      </div>

      {/* Info Sidebar Overlay */}
      {infoSidebar && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setInfoSidebar(null)}>
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="relative w-full max-w-md bg-white h-full overflow-y-auto p-8 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-[30px] h-[30px] bg-cobalt rounded-lg">
                  {infoSidebar === "dev" ? (
                    <SvgIcon name="developer-mode" width={14} height={8} className="text-white" />
                  ) : (
                    <SvgIcon name="pencil" width={14} height={14} className="text-white" />
                  )}
                </div>
                <p className="text-base font-bold text-black">
                  {infoSidebar === "dev" ? "Development" : "Design"}
                </p>
              </div>
              <button onClick={() => setInfoSidebar(null)} className="cursor-pointer p-1">
                <X className="w-5 h-5 text-black" />
              </button>
            </div>

            <h3 className="text-2xl font-semibold text-black mb-6">What&apos;s included</h3>

            <div className="flex flex-col gap-6">
              {(infoSidebar === "dev" ? DEV_INCLUDED : DESIGN_INCLUDED).map((section, i) => (
                <div key={i}>
                  <p className="text-sm font-bold text-cobalt mb-2">
                    <span className="mr-2">{String(i + 1).padStart(2, "0")}</span>
                    {section.title}
                  </p>
                  <ul className="list-disc list-inside text-xs text-black space-y-1 pl-1">
                    {section.items.map((item, j) => (
                      <li key={j}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
