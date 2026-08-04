import { describe, expect, it } from "vitest";
import { parseUrl } from "./urlGuard";

describe("parseUrl", () => {
  it("accepts a well-formed https URL", () => {
    const r = parseUrl("https://example.com/path?q=1");
    expect(r.ok).toBe(true);
    expect(r.url?.hostname).toBe("example.com");
  });

  it("rejects invalid URLs", () => {
    expect(parseUrl("not a url").ok).toBe(false);
    expect(parseUrl("").ok).toBe(false);
  });

  it("rejects non-http protocols", () => {
    expect(parseUrl("ftp://example.com").ok).toBe(false);
    expect(parseUrl("file:///etc/passwd").ok).toBe(false);
    expect(parseUrl("javascript:alert(1)").ok).toBe(false);
  });

  it("rejects embedded credentials", () => {
    expect(parseUrl("https://user:pass@example.com").ok).toBe(false);
  });

  it("rejects localhost and loopback", () => {
    expect(parseUrl("http://localhost").ok).toBe(false);
    expect(parseUrl("http://127.0.0.1").ok).toBe(false);
    expect(parseUrl("http://[::1]").ok).toBe(false);
  });

  it("rejects RFC1918 private ranges", () => {
    expect(parseUrl("http://10.0.0.1").ok).toBe(false);
    expect(parseUrl("http://172.16.0.1").ok).toBe(false);
    expect(parseUrl("http://172.31.255.254").ok).toBe(false);
    expect(parseUrl("http://192.168.1.1").ok).toBe(false);
  });

  it("rejects link-local and CGNAT", () => {
    expect(parseUrl("http://169.254.169.254").ok).toBe(false);
    expect(parseUrl("http://100.64.0.1").ok).toBe(false);
  });

  it("rejects private-looking host suffixes", () => {
    expect(parseUrl("http://foo.local").ok).toBe(false);
    expect(parseUrl("http://foo.internal").ok).toBe(false);
  });

  it("accepts public IPs", () => {
    expect(parseUrl("http://8.8.8.8").ok).toBe(true);
  });
});
