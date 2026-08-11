import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:dns", () => ({
  promises: { lookup: vi.fn().mockResolvedValue([{ address: "93.184.216.34", family: 4 }]) },
}));

import { SCAN_DEFAULTS } from "@/lib/constants";
import { checkRateLimit, rateLimit } from "./_internals";

describe("checkRateLimit", () => {
  beforeEach(() => {
    rateLimit.clear();
  });

  it("allows up to rateLimitPerHour requests per IP and blocks the next one", () => {
    const ip = "203.0.113.1";
    for (let i = 0; i < SCAN_DEFAULTS.rateLimitPerHour; i++) {
      expect(checkRateLimit(ip)).toBe(true);
    }
    expect(checkRateLimit(ip)).toBe(false);
  });

  it("tracks distinct IPs independently", () => {
    const a = "203.0.113.2";
    const b = "203.0.113.3";
    for (let i = 0; i < SCAN_DEFAULTS.rateLimitPerHour; i++) {
      expect(checkRateLimit(a)).toBe(true);
    }
    expect(checkRateLimit(a)).toBe(false);
    // Second IP is unaffected.
    expect(checkRateLimit(b)).toBe(true);
  });

  it("drops entries older than the rolling window so allowance recovers", () => {
    const ip = "203.0.113.4";
    const nowSpy = vi.spyOn(Date, "now");
    const t0 = 1_800_000_000_000;
    nowSpy.mockReturnValue(t0);
    for (let i = 0; i < SCAN_DEFAULTS.rateLimitPerHour; i++) {
      expect(checkRateLimit(ip)).toBe(true);
    }
    expect(checkRateLimit(ip)).toBe(false);

    // Fast-forward past the 1-hour window.
    nowSpy.mockReturnValue(t0 + 61 * 60 * 1000);
    expect(checkRateLimit(ip)).toBe(true);
    nowSpy.mockRestore();
  });
});