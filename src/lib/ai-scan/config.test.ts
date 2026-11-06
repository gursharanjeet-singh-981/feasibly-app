import { afterEach, describe, expect, it, vi } from "vitest";
import { providerLimits } from "./config";

afterEach(() => vi.unstubAllEnvs());

describe("provider limits", () => {
  it("defaults to the free-tier numbers", () => {
    const l = providerLimits();
    expect(l.gemini).toMatchObject({ rpm: 15, rpd: 500, dailyCallCap: 450 });
    expect(l.gemini.minIntervalMs).toBeGreaterThan(4000);
  });

  it("follows the limits set in the environment, so a higher tier raises the pace and the cap", () => {
    vi.stubEnv("AI_SCAN_GEMINI_RPM", "60");
    vi.stubEnv("AI_SCAN_GEMINI_RPD", "10000");
    const l = providerLimits();
    expect(l.gemini.minIntervalMs).toBeLessThan(1200);
    expect(l.gemini.dailyCallCap).toBe(9000);
  });

  it("uses an explicit daily call cap when one is set", () => {
    vi.stubEnv("AI_SCAN_GEMINI_DAILY_CALLS", "1234");
    expect(providerLimits().gemini.dailyCallCap).toBe(1234);
  });
});
