import { describe, it, expect } from "vitest";
import { calculateEstimation } from "./calculations";
import type { SelectedComponent, SelectedTemplate } from "@/types";

function makeComponent(over: Partial<SelectedComponent> = {}): SelectedComponent {
  return {
    id: 1,
    group: "Forms",
    name: "Input",
    category: "Core",
    designDescription: "",
    developmentDescription: "",
    designEffort: 2,
    aiDesignEffort: 1,
    devEffort: 3,
    aiDevEffort: 2,
    assumptions: "",
    isSelected: true,
    ...over,
  };
}

function makeTemplate(over: Partial<SelectedTemplate> = {}): SelectedTemplate {
  return {
    id: 1,
    name: "Landing",
    category: "Marketing",
    description: "",
    designEffortBase: 4,
    aiDesignEffortBase: 2,
    designEffortPerPage: 1,
    devEffortBase: 6,
    aiDevEffortBase: 3,
    devEffortPerPage: 2,
    isSelected: true,
    additionalPages: 0,
    ...over,
  };
}

describe("calculateEstimation", () => {
  it("returns zeroed summary when nothing is selected", () => {
    const result = calculateEstimation([], [], false);
    expect(result.totalComponents).toBe(0);
    expect(result.totalVariants).toBe(0);
    expect(result.totalTemplates).toBe(0);
    expect(result.totalAdditionalPages).toBe(0);
    expect(result.designDays).toBe(0);
    expect(result.devDays).toBe(0);
    expect(result.designWeeks).toBe(0);
    expect(result.devWeeks).toBe(0);
  });

  it("skips unselected components and templates", () => {
    const result = calculateEstimation(
      [makeComponent({ isSelected: false })],
      [makeTemplate({ isSelected: false })],
      false,
    );
    expect(result.totalVariants).toBe(0);
    expect(result.totalTemplates).toBe(0);
    expect(result.designDays).toBe(0);
  });

  it("counts unique component groups as totalComponents", () => {
    const result = calculateEstimation(
      [
        makeComponent({ id: 1, group: "Forms" }),
        makeComponent({ id: 2, group: "Forms" }),
        makeComponent({ id: 3, group: "Media" }),
      ],
      [],
      false,
    );
    expect(result.totalComponents).toBe(2);
    expect(result.totalVariants).toBe(3);
  });

  it("applies 20% buffer and 5-days-per-week rounding", () => {
    const result = calculateEstimation(
      [makeComponent({ designEffort: 10, devEffort: 10 })],
      [],
      false,
    );
    expect(result.designDays).toBe(10);
    expect(result.designDaysWithBuffer).toBeCloseTo(12);
    expect(result.designWeeks).toBe(3); // ceil(12 / 5)
    expect(result.devWeeks).toBe(3);
  });

  it("includes template additional pages in per-page effort and page count", () => {
    const result = calculateEstimation(
      [],
      [makeTemplate({ additionalPages: 4 })],
      false,
    );
    expect(result.totalTemplates).toBe(1);
    expect(result.totalAdditionalPages).toBe(4);
    // 4 base + 4 pages * 1 per-page = 8 design days
    expect(result.designDays).toBe(8);
    // 6 base + 4 pages * 2 per-page = 14 dev days
    expect(result.devDays).toBe(14);
  });

  it("uses AI effort values when useAi=true", () => {
    const result = calculateEstimation(
      [makeComponent({ designEffort: 10, aiDesignEffort: 1, devEffort: 10, aiDevEffort: 2 })],
      [],
      true,
    );
    expect(result.designDays).toBe(1);
    expect(result.devDays).toBe(2);
  });
});
