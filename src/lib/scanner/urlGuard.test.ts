import { describe, expect, it, vi } from "vitest";

vi.mock("node:dns", () => {
  return {
    promises: {
      lookup: vi.fn(),
    },
  };
});

import { promises as dns } from "node:dns";
import {
  UrlGuardError,
  assertPublicUrl,
  isPublicHost,
  resolveAndAssertPublic,
} from "./urlGuard";

const lookup = dns.lookup as unknown as ReturnType<typeof vi.fn>;

describe("assertPublicUrl", () => {
  it("accepts a plain public https URL", () => {
    expect(() => assertPublicUrl("https://example.com/path")).not.toThrow();
  });

  it("rejects non-parseable input", () => {
    expect(() => assertPublicUrl("not a url")).toThrow(UrlGuardError);
  });

  it.each([
    "ftp://example.com",
    "file:///etc/passwd",
    "javascript:alert(1)",
    "data:text/html,<h1>hi</h1>",
  ])("rejects protocol %s", (input) => {
    expect(() => assertPublicUrl(input)).toThrow(/Protocol not allowed/);
  });

  it.each([
    "http://localhost",
    "http://LOCALHOST:3000",
    "http://ip6-localhost",
    "http://127.0.0.1",
    "http://127.10.20.30",
    "http://10.0.0.5",
    "http://172.16.0.1",
    "http://172.31.255.255",
    "http://192.168.1.1",
    "http://169.254.169.254", // AWS/GCP metadata
    "http://0.0.0.0",
    "http://100.64.0.1", // CGNAT
    "http://[::1]",
    "http://[fe80::1]",
    "http://[fc00::1]",
    "http://something.local",
    "http://api.internal",
    "http://svc.corp",
  ])("rejects private/reserved host %s", (input) => {
    expect(() => assertPublicUrl(input)).toThrow(UrlGuardError);
  });

  it("preserves the path and query on the returned URL", () => {
    const url = assertPublicUrl("https://example.com/foo?bar=1");
    expect(url.pathname).toBe("/foo");
    expect(url.search).toBe("?bar=1");
  });
});

describe("isPublicHost", () => {
  it("returns false for known private hosts", () => {
    expect(isPublicHost("localhost")).toBe(false);
    expect(isPublicHost("10.0.0.1")).toBe(false);
    expect(isPublicHost("api.internal")).toBe(false);
  });

  it("returns true for public hostnames and IPs", () => {
    expect(isPublicHost("example.com")).toBe(true);
    expect(isPublicHost("8.8.8.8")).toBe(true);
  });
});

describe("resolveAndAssertPublic", () => {
  it("passes through numeric public hosts without DNS", async () => {
    lookup.mockReset();
    const url = await resolveAndAssertPublic("https://8.8.8.8/");
    expect(url.hostname).toBe("8.8.8.8");
    expect(lookup).not.toHaveBeenCalled();
  });

  it("rejects a hostname that resolves to a private address", async () => {
    lookup.mockReset();
    lookup.mockResolvedValueOnce([{ address: "10.0.0.5", family: 4 }]);
    await expect(
      resolveAndAssertPublic("https://sneaky.example.com/"),
    ).rejects.toMatchObject({ code: "private_host" });
  });

  it("rejects when DNS lookup fails", async () => {
    lookup.mockReset();
    lookup.mockRejectedValueOnce(new Error("ENOTFOUND"));
    await expect(
      resolveAndAssertPublic("https://nope.example.invalid/"),
    ).rejects.toMatchObject({ code: "dns_failure" });
  });

  it("accepts a hostname that resolves to public addresses", async () => {
    lookup.mockReset();
    lookup.mockResolvedValueOnce([
      { address: "93.184.216.34", family: 4 },
      { address: "2606:2800:220:1:248:1893:25c8:1946", family: 6 },
    ]);
    const url = await resolveAndAssertPublic("https://example.com/");
    expect(url.hostname).toBe("example.com");
  });

  it("rejects when any resolved address is private (multi-record case)", async () => {
    lookup.mockReset();
    lookup.mockResolvedValueOnce([
      { address: "93.184.216.34", family: 4 },
      { address: "192.168.1.10", family: 4 },
    ]);
    await expect(
      resolveAndAssertPublic("https://mixed.example.com/"),
    ).rejects.toMatchObject({ code: "private_host" });
  });
});
