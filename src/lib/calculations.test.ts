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
    expect(result.designHours).toBe(0);
    expect(result.devHours).toBe(0);
    expect(result.designDays).toBe(0);
    expect(result.devDays).toBe(0);
  });

  it("skips unselected components and templates", () => {
    const result = calculateEstimation(
      [makeComponent({ isSelected: false })],
      [makeTemplate({ isSelected: false })],
      false,
    );
    expect(result.totalVariants).toBe(0);
    expect(result.totalTemplates).toBe(0);
    expect(result.designHours).toBe(0);
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

  it("applies the buffer to hours and rounds up days at 6 hours per day", () => {
    const result = calculateEstimation(
      [makeComponent({ designEffort: 10, devEffort: 10 })],
      [],
      false,
    );
    expect(result.designHours).toBe(10);
    expect(result.designHoursWithBuffer).toBeCloseTo(12);
    expect(result.designDays).toBe(2); // ceil(12 / 6)
    expect(result.devDays).toBe(2);
  });

  it("applies the selected buffer percentage", () => {
    const component = makeComponent({ designEffort: 10, devEffort: 10 });
    const bufferedHoursByPercent = [0, 5, 10, 15, 20].map((bufferPercent) =>
      calculateEstimation([component], [], false, bufferPercent).designHoursWithBuffer,
    );

    expect(bufferedHoursByPercent).toEqual([10, 10.5, 11, 11.5, 12]);
  });

  it("includes template additional pages in per-page effort and page count", () => {
    const result = calculateEstimation(
      [],
      [makeTemplate({ additionalPages: 4 })],
      false,
    );
    expect(result.totalTemplates).toBe(1);
    expect(result.totalAdditionalPages).toBe(4);
    expect(result.designHours).toBe(8);
    expect(result.devHours).toBe(14);
    expect(result.designDays).toBe(2); // ceil((8 * 1.2) / 6)
    expect(result.devDays).toBe(3); // ceil((14 * 1.2) / 6)
  });

  it("uses AI effort values when useAi=true", () => {
    const result = calculateEstimation(
      [makeComponent({ designEffort: 10, aiDesignEffort: 1, devEffort: 10, aiDevEffort: 2 })],
      [],
      true,
    );
    expect(result.designHours).toBe(1);
    expect(result.devHours).toBe(2);
    expect(result.designDays).toBe(1);
    expect(result.devDays).toBe(1);
  });
});
