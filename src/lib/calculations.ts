import type { SelectedComponent, SelectedTemplate, EstimationSummary } from "@/types";
import { BUFFER_MULTIPLIER, DAYS_PER_WEEK } from "@/lib/constants";

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

export function calculateEstimation(
  components: SelectedComponent[],
  templates: SelectedTemplate[],
  useAi = false
): EstimationSummary {
  const selectedComponents = components.filter((c) => c.isSelected);
  const selectedTemplates = templates.filter((t) => t.isSelected);

  const comp = componentsSubtotal(components, useAi);
  const tmpl = templatesSubtotal(templates, useAi);

  const designDays = comp.design + tmpl.totalDesign;
  const devDays = comp.dev + tmpl.totalDev;

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
