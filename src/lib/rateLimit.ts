// Per-IP sliding-window limit for routes that spend paid API quota. Held in memory, so each
// serverless instance keeps its own count. It stops casual abuse; it is not a hard global cap.
const buckets = new Map<string, number[]>();

export function consumeRateLimit(key: string, limit: number, windowMs = 60 * 60 * 1000): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;
  const recent = (buckets.get(key) ?? []).filter((t) => t > cutoff);
  if (recent.length >= limit) {
    buckets.set(key, recent);
    return false;
  }
  recent.push(now);
  buckets.set(key, recent);
  return true;
}

export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
