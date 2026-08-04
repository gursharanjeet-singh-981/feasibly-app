"use client";

import { useMemo, useState } from "react";
import { useAppStore } from "@/store";
import { calculateEstimation } from "@/lib/calculations";
import { EstimationCard } from "@/components/estimation/EstimationCard";
import { StatTile } from "@/components/estimation/StatTile";
import { ExportButtons } from "@/components/estimation/ExportButtons";
import {
  InfoSidebar,
  type InfoKind,
} from "@/components/estimation/InfoSidebar";

export function EstimationPanel() {
  const components = useAppStore((s) => s.components);
  const templates = useAppStore((s) => s.templates);
  const project = useAppStore((s) => s.project);
  const useAiEstimation = useAppStore((s) => s.useAiEstimation);

  const [infoSidebar, setInfoSidebar] = useState<InfoKind | null>(null);

  const estimation = useMemo(
    () => calculateEstimation(components, templates, useAiEstimation),
    [components, templates, useAiEstimation],
  );

  return (
    <div className="bg-surface-muted flex flex-col justify-between rounded-3xl lg:rounded-[60px] p-6 md:p-8 lg:p-10 w-full h-full overflow-y-auto">
      <div className="flex flex-col gap-8 lg:gap-10">
        <div className="flex flex-col gap-7.5">
          <h2 className="text-2xl lg:text-[30px] font-semibold text-black">
            Your estimation
          </h2>

          {project.scope.components && (
            <div className="flex gap-7.5 items-start">
              <StatTile
                icon="components"
                label="Total Components"
                helper="This is main category (ie: forms)"
                value={estimation.totalComponents}
              />
              <div className="w-px h-18.25 bg-[#d9d9d9] self-center shrink-0" />
              <StatTile
                icon="graph"
                label="Total Variants"
                helper="This is the variants within a component"
                value={estimation.totalVariants}
              />
            </div>
          )}

          {project.scope.templates && (
            <div className="flex gap-7.5 items-start">
              <StatTile
                icon="file-copy"
                iconClassName="text-black opacity-54"
                label="Total Templates"
                helper="Total amount of templates"
                value={estimation.totalTemplates}
              />
              <div className="w-px h-18.25 bg-[#d9d9d9] self-center shrink-0" />
              <StatTile
                icon="add-to-queue"
                iconClassName="text-black opacity-54"
                label="Additional Pages"
                helper="Total amount of additional pages"
                value={estimation.totalAdditionalPages}
              />
            </div>
          )}
        </div>

        <EstimationCard
          icon="developer-mode"
          iconWidth={14}
          iconHeight={8}
          title="Development"
          days={estimation.devDaysWithBuffer}
          weeks={estimation.devWeeks}
          note="Includes both Front-end & Back-end"
          onInfo={() => setInfoSidebar("dev")}
        />

        <EstimationCard
          icon="pencil"
          iconWidth={14}
          iconHeight={14}
          title="Design"
          days={estimation.designDaysWithBuffer}
          weeks={estimation.designWeeks}
          note="Includes both UX & UI"
          onInfo={() => setInfoSidebar("design")}
        />
      </div>

      <ExportButtons
        project={project}
        components={components}
        templates={templates}
        estimation={estimation}
        useAi={useAiEstimation}
      />

      {infoSidebar && (
        <InfoSidebar
          kind={infoSidebar}
          onClose={() => setInfoSidebar(null)}
        />
      )}
    </div>
  );
}
