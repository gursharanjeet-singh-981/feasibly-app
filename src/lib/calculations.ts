import type { SelectedComponent, SelectedTemplate, EstimationSummary } from "@/types";

const BUFFER_MULTIPLIER = 1.2;
const DAYS_PER_WEEK = 5;

export function calculateEstimation(
  components: SelectedComponent[],
  templates: SelectedTemplate[]
): EstimationSummary {
  const selectedComponents = components.filter((c) => c.isSelected);
  const selectedTemplates = templates.filter((t) => t.isSelected);

  const componentDesignDays = selectedComponents.reduce(
    (sum, c) => sum + c.designEffort,
    0
  );
  const componentDevDays = selectedComponents.reduce(
    (sum, c) => sum + c.devEffort,
    0
  );

  const templateDesignDays = selectedTemplates.reduce(
    (sum, t) =>
      sum + t.designEffortBase + t.additionalPages * t.designEffortPerPage,
    0
  );
  const templateDevDays = selectedTemplates.reduce(
    (sum, t) =>
      sum + t.devEffortBase + t.additionalPages * t.devEffortPerPage,
    0
  );

  const designDays = componentDesignDays + templateDesignDays;
  const devDays = componentDevDays + templateDevDays;

  const designDaysWithBuffer = designDays * BUFFER_MULTIPLIER;
  const devDaysWithBuffer = devDays * BUFFER_MULTIPLIER;

  return {
    totalComponents: selectedComponents.length,
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
