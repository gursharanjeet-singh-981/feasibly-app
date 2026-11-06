import type { SelectedComponent, SelectedTemplate, EstimationSummary } from "@/types";
import { DEFAULT_BUFFER_PERCENT, DEFAULT_HOURS_PER_DAY } from "@/lib/constants";

export function componentDesignEffort(c: SelectedComponent, useAi: boolean): number {
  return useAi ? c.aiDesignEffort : c.designEffort;
}

export function componentDevEffort(c: SelectedComponent, useAi: boolean): number {
  return useAi ? c.aiDevEffort : c.devEffort;
}

export function templateDesignBase(t: SelectedTemplate, useAi: boolean): number {
  return useAi ? t.aiDesignEffortBase : t.designEffortBase;
}

export function templateDevBase(t: SelectedTemplate, useAi: boolean): number {
  return useAi ? t.aiDevEffortBase : t.devEffortBase;
}

export function templateTotalDesign(t: SelectedTemplate, useAi: boolean): number {
  return templateDesignBase(t, useAi) + t.additionalPages * t.designEffortPerPage;
}

export function templateTotalDev(t: SelectedTemplate, useAi: boolean): number {
  return templateDevBase(t, useAi) + t.additionalPages * t.devEffortPerPage;
}

export interface ComponentsSubtotal {
  design: number;
  dev: number;
}

export function componentsSubtotal(
  components: SelectedComponent[],
  useAi: boolean,
): ComponentsSubtotal {
  const selected = components.filter((c) => c.isSelected);
  return {
    design: selected.reduce((s, c) => s + componentDesignEffort(c, useAi), 0),
    dev: selected.reduce((s, c) => s + componentDevEffort(c, useAi), 0),
  };
}

export interface TemplatesSubtotal {
  designBase: number;
  devBase: number;
  additionalPages: number;
  totalDesign: number;
  totalDev: number;
}

export function templatesSubtotal(
  templates: SelectedTemplate[],
  useAi: boolean,
): TemplatesSubtotal {
  const selected = templates.filter((t) => t.isSelected);
  return {
    designBase: selected.reduce((s, t) => s + templateDesignBase(t, useAi), 0),
    devBase: selected.reduce((s, t) => s + templateDevBase(t, useAi), 0),
    additionalPages: selected.reduce((s, t) => s + t.additionalPages, 0),
    totalDesign: selected.reduce((s, t) => s + templateTotalDesign(t, useAi), 0),
    totalDev: selected.reduce((s, t) => s + templateTotalDev(t, useAi), 0),
  };
}

/** The day figure as shown on screen and in the PDF: "1 day", "2.5 days". */
export function formatDays(days: number): string {
  return `${days} ${days === 1 ? "day" : "days"}`;
}

/**
 * Days rounded up to the next half day, so 2.57 days shows as 3 and 0.6 days as 1. Rounding up keeps
 * the estimate from understating effort. Any non-zero effort shows at least half a day.
 */
export function roundDaysToHalf(days: number): number {
  if (days <= 0) return 0;
  return Math.max(0.5, Math.ceil(days * 2) / 2);
}

export function calculateEstimation(
  components: SelectedComponent[],
  templates: SelectedTemplate[],
  useAi = false,
  bufferPercent = DEFAULT_BUFFER_PERCENT,
  hoursPerDay = DEFAULT_HOURS_PER_DAY,
): EstimationSummary {
  const selectedComponents = components.filter((c) => c.isSelected);
  const selectedTemplates = templates.filter((t) => t.isSelected);

  const comp = componentsSubtotal(components, useAi);
  const tmpl = templatesSubtotal(templates, useAi);

  const designHours = comp.design + tmpl.totalDesign;
  const devHours = comp.dev + tmpl.totalDev;

  const bufferMultiplier = 1 + bufferPercent / 100;
  const designHoursWithBuffer = designHours * bufferMultiplier;
  const devHoursWithBuffer = devHours * bufferMultiplier;

  const uniqueGroups = new Set(selectedComponents.map((c) => c.group));

  return {
    totalComponents: uniqueGroups.size,
    totalVariants: selectedComponents.length,
    totalTemplates: selectedTemplates.length,
    totalAdditionalPages: tmpl.additionalPages,
    designHours,
    designHoursWithBuffer,
    designDays: roundDaysToHalf(designHoursWithBuffer / hoursPerDay),
    devHours,
    devHoursWithBuffer,
    devDays: roundDaysToHalf(devHoursWithBuffer / hoursPerDay),
  };
}

