import { describe, expect, it } from "vitest";
import { countMatchedGroups } from "./scanCounts";

describe("countMatchedGroups", () => {
  it("counts unique component groups rather than matched variants", () => {
    expect(
      countMatchedGroups({
        1: { confidence: 0.8, pages: ["https://x.com"], group: "Image" },
        2: { confidence: 0.7, pages: ["https://x.com"], group: "Image" },
        3: { confidence: 0.9, pages: ["https://x.com"], group: "CTA" },
      }),
    ).toBe(2);
  });
});