import type { SelectedComponent, SelectedTemplate, EstimationSummary } from "@/types";
import { BUFFER_MULTIPLIER, DAYS_PER_WEEK } from "@/lib/constants";

export function calculateEstimation(
  components: SelectedComponent[],
  templates: SelectedTemplate[],
  useAi = false
): EstimationSummary {
  const selectedComponents = components.filter((c) => c.isSelected);
  const selectedTemplates = templates.filter((t) => t.isSelected);

  const componentDesignDays = selectedComponents.reduce(
    (sum, c) => sum + (useAi ? c.aiDesignEffort : c.designEffort),
    0
  );
  const componentDevDays = selectedComponents.reduce(
    (sum, c) => sum + (useAi ? c.aiDevEffort : c.devEffort),
    0
  );

  const templateDesignDays = selectedTemplates.reduce(
    (sum, t) =>
      sum + (useAi ? t.aiDesignEffortBase : t.designEffortBase) + t.additionalPages * t.designEffortPerPage,
    0
  );
  const templateDevDays = selectedTemplates.reduce(
    (sum, t) =>
      sum + (useAi ? t.aiDevEffortBase : t.devEffortBase) + t.additionalPages * t.devEffortPerPage,
    0
  );

  const designDays = componentDesignDays + templateDesignDays;
  const devDays = componentDevDays + templateDevDays;

  const designDaysWithBuffer = designDays * BUFFER_MULTIPLIER;
  const devDaysWithBuffer = devDays * BUFFER_MULTIPLIER;

  const uniqueGroups = new Set(selectedComponents.map((c) => c.group));

  return {
    totalComponents: uniqueGroups.size,
    totalVariants: selectedComponents.length,
    totalTemplates: selectedTemplates.length,
    totalAdditionalPages: selectedTemplates.reduce(
      (sum, t) => sum + t.additionalPages,
      0
    ),
    designDays,
    designDaysWithBuffer,
    designWeeks: Math.ceil(designDaysWithBuffer / DAYS_PER_WEEK),
    devDays,
    devDaysWithBuffer,
    devWeeks: Math.ceil(devDaysWithBuffer / DAYS_PER_WEEK),
  };
}
