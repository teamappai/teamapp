import "server-only";

/**
 * Dead-simple in-memory, fixed-window rate limiter. Keyed by an arbitrary
 * string (e.g. an IP address). Good enough for low-volume endpoints like the
 * public contact form.
 *
 * Caveats (upgrade before relying on this at scale): the store is per-process,
 * so it resets on deploy and is NOT shared across serverless instances. Swap in
 * a durable store (e.g. Upstash/Redis) when traffic warrants it.
 */
type Window = { count: number; resetAt: number };

const buckets = new Map<string, Window>();

export function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  existing.count += 1;
  const allowed = existing.count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
  };
}
