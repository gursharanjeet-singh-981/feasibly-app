import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export interface UrlGuardResult {
  ok: boolean;
  url?: URL;
  reason?: string;
}

const PRIVATE_HOST_SUFFIXES = [
  ".local",
  ".internal",
  ".localhost",
  ".test",
  ".example",
  ".invalid",
];

// RFC1918 + loopback + link-local + CGNAT + IPv6 loopback/ULA/link-local.
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fe80")) return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  if (lower.startsWith("::ffff:")) {
    const v4 = lower.slice(7);
    if (isIP(v4) === 4) return isPrivateIPv4(v4);
  }
  return false;
}

function isPrivateAddress(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return isPrivateIPv4(ip);
  if (kind === 6) return isPrivateIPv6(ip);
  return true;
}

export function parseUrl(input: string): UrlGuardResult {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return { ok: false, reason: "Invalid URL" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "Only http(s) URLs are allowed" };
  }
  if (url.username || url.password) {
    return { ok: false, reason: "URLs with embedded credentials are not allowed" };
  }
  const host = url.hostname.toLowerCase();
  if (!host) return { ok: false, reason: "Missing host" };
  if (host === "localhost") {
    return { ok: false, reason: "Localhost is not allowed" };
  }
  if (PRIVATE_HOST_SUFFIXES.some((s) => host.endsWith(s))) {
    return { ok: false, reason: `Host suffix is not routable: ${host}` };
  }
  // URL.hostname wraps IPv6 in brackets; strip before net.isIP.
  const bareHost = host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
  if (isIP(bareHost) && isPrivateAddress(bareHost)) {
    return { ok: false, reason: "Private or reserved IP address" };
  }
  return { ok: true, url };
}

// Full DNS-resolving guard for use in the request path (route handler, crawler).
// parseUrl handles the cheap syntactic checks; this one adds the network check.
export async function assertPublicUrl(input: string): Promise<UrlGuardResult> {
  const parsed = parseUrl(input);
  if (!parsed.ok || !parsed.url) return parsed;
  const host = parsed.url.hostname;
  if (isIP(host)) return parsed;
  try {
    const results = await lookup(host, { all: true });
    if (!results.length) {
      return { ok: false, reason: "DNS resolution failed" };
    }
    for (const r of results) {
      if (isPrivateAddress(r.address)) {
        return { ok: false, reason: `Host resolves to a private IP: ${r.address}` };
      }
    }
  } catch {
    return { ok: false, reason: "DNS resolution failed" };
  }
  return parsed;
}
