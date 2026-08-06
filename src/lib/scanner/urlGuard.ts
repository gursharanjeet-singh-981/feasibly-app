import { promises as dns } from "node:dns";
import { isIP } from "node:net";

export class UrlGuardError extends Error {
  readonly code:
    | "invalid_url"
    | "non_http"
    | "private_host"
    | "blocked_tld"
    | "dns_failure";
  constructor(code: UrlGuardError["code"], message: string) {
    super(message);
    this.code = code;
    this.name = "UrlGuardError";
  }
}

const BLOCKED_HOSTS = new Set([
  "localhost",
  "ip6-localhost",
  "ip6-loopback",
  "broadcasthost",
]);

const BLOCKED_TLDS = [".local", ".internal", ".localhost", ".lan", ".home", ".corp", ".intranet"];

// Parse a candidate URL string. Rejects anything that isn't http(s)://public-host.
export function assertPublicUrl(input: string): URL {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new UrlGuardError("invalid_url", "URL is not parseable");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UrlGuardError("non_http", `Protocol not allowed: ${url.protocol}`);
  }

  const host = unbracketHost(url.hostname.toLowerCase());
  if (!host) {
    throw new UrlGuardError("invalid_url", "URL has no host");
  }

  if (BLOCKED_HOSTS.has(host)) {
    throw new UrlGuardError("private_host", `Blocked host: ${host}`);
  }

  for (const tld of BLOCKED_TLDS) {
    if (host === tld.slice(1) || host.endsWith(tld)) {
      throw new UrlGuardError("blocked_tld", `Blocked TLD: ${host}`);
    }
  }

  const ipKind = isIP(host);
  if (ipKind === 4 && isPrivateIPv4(host)) {
    throw new UrlGuardError("private_host", `Private IPv4: ${host}`);
  }
  if (ipKind === 6 && isPrivateIPv6(host)) {
    throw new UrlGuardError("private_host", `Private IPv6: ${host}`);
  }

  return url;
}

function unbracketHost(host: string): string {
  return host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
}

export function isPublicHost(host: string): boolean {
  const h = unbracketHost(host.toLowerCase());
  if (BLOCKED_HOSTS.has(h)) return false;
  for (const tld of BLOCKED_TLDS) {
    if (h === tld.slice(1) || h.endsWith(tld)) return false;
  }
  const kind = isIP(h);
  if (kind === 4) return !isPrivateIPv4(h);
  if (kind === 6) return !isPrivateIPv6(h);
  return true;
}

// Resolve the URL's hostname via DNS and confirm every returned address is public.
// Callers should invoke this before making the HTTP request so DNS-rebinding
// against a public hostname pointing at private space is caught.
export async function resolveAndAssertPublic(input: string | URL): Promise<URL> {
  const url = input instanceof URL ? input : assertPublicUrl(input);
  const host = unbracketHost(url.hostname);

  if (isIP(host)) {
    // Numeric hosts are already validated by assertPublicUrl above.
    return url;
  }

  let addrs: { address: string; family: number }[];
  try {
    addrs = await dns.lookup(host, { all: true, verbatim: true });
  } catch (err) {
    throw new UrlGuardError(
      "dns_failure",
      `DNS lookup failed for ${host}: ${(err as Error).message}`,
    );
  }

  if (addrs.length === 0) {
    throw new UrlGuardError("dns_failure", `No DNS records for ${host}`);
  }

  for (const { address, family } of addrs) {
    const bad =
      (family === 4 && isPrivateIPv4(address)) ||
      (family === 6 && isPrivateIPv6(address));
    if (bad) {
      throw new UrlGuardError(
        "private_host",
        `Host ${host} resolves to private address ${address}`,
      );
    }
  }

  return url;
}

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true; // Malformed → treat as unsafe.
  }
  const [a, b] = parts;
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 169 && b === 254) return true; // link-local
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 192 && b === 0 && parts[2] === 0) return true; // 192.0.0.0/24
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  if (a >= 224) return true; // multicast + reserved
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::" || lower === "::1") return true;
  if (lower.startsWith("fe80:")) return true; // link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // ULA fc00::/7
  if (lower.startsWith("ff")) return true; // multicast
  if (lower.startsWith("::ffff:")) {
    // IPv4-mapped — validate the embedded v4.
    const v4 = lower.slice("::ffff:".length);
    if (isIP(v4) === 4) return isPrivateIPv4(v4);
  }
  return false;
}
