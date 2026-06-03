import "server-only";
import { PostHog } from "posthog-node";

import { createServiceClient } from "@/lib/supabase/service";
import { posthogServerEnv } from "@/lib/env";

/**
 * Hybrid feature-flag resolver (Phase 15, Decision 4: DB + PostHog).
 *
 * Resolution order for `getFlag(key, { userId, companyId })`:
 *   1. `public.feature_flags` row for `key` (server-side, DB-controlled):
 *        • `enabled === false`            → false  (explicit kill switch)
 *        • `enabled === true`             → true   (explicit force-on)
 *        • `enabled_globally === true`    → true   (on for everyone)
 *        • companyId ∈ enabled_company_ids → true  (per-company allowlist)
 *        • otherwise                      → fall through to PostHog
 *   2. PostHog evaluation via posthog-node (Personal API Key), passing
 *      `distinctId = userId` and `groups = { company: companyId }`.
 *   3. Default `false` if PostHog is unconfigured/unreachable.
 *
 * Server-only — never import from a client component. Client code reads flags
 * directly through the PostHog browser SDK (`posthog.isFeatureEnabled`).
 *
 * Caching: a tiny in-process map with a 60s TTL keyed by
 * `${key}:${userId}:${companyId}` keeps the DB + PostHog round-trips off the hot
 * path. Acceptable staleness for flags; bounded so it can't grow unbounded.
 */

export type FlagContext = {
  userId?: string;
  companyId?: string;
};

type FlagValue = boolean | string;

const CACHE_TTL_MS = 60_000;
const CACHE_MAX = 500;

const cache = new Map<string, { value: FlagValue; expires: number }>();

function cacheKey(key: string, ctx: FlagContext): string {
  return `${key}:${ctx.userId ?? ""}:${ctx.companyId ?? ""}`;
}

function cacheGet(k: string): FlagValue | undefined {
  const hit = cache.get(k);
  if (!hit) return undefined;
  if (hit.expires < cacheClock()) {
    cache.delete(k);
    return undefined;
  }
  return hit.value;
}

function cacheSet(k: string, value: FlagValue): void {
  // Crude LRU: evict the oldest insertion when over capacity.
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(k, { value, expires: cacheClock() + CACHE_TTL_MS });
}

// Indirection so tests can stub time without Date.now sprinkled around.
function cacheClock(): number {
  return Date.now();
}

/**
 * DB lookup. Uses the service client (RLS on feature_flags only allows
 * super_admin writes; reads are open, but the resolver runs in trusted server
 * context and may have no user session — service client is the safe choice).
 * Returns a definitive boolean, or null to mean "defer to PostHog".
 */
async function resolveFromDb(
  key: string,
  ctx: FlagContext,
): Promise<boolean | null> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("feature_flags")
      .select("enabled, enabled_globally, enabled_company_ids")
      .eq("key", key)
      .maybeSingle();
    if (error || !data) return null;

    if (data.enabled === false) return false;
    if (data.enabled === true) return true;
    if (data.enabled_globally) return true;
    if (
      ctx.companyId &&
      Array.isArray(data.enabled_company_ids) &&
      data.enabled_company_ids.includes(ctx.companyId)
    ) {
      return true;
    }
    return null;
  } catch {
    return null;
  }
}

/** PostHog evaluation. Returns false when unconfigured/unreachable. */
async function resolveFromPostHog(
  key: string,
  ctx: FlagContext,
): Promise<FlagValue> {
  const env = posthogServerEnv();
  if (!env || !ctx.userId) return false;

  const client = new PostHog(env.NEXT_PUBLIC_POSTHOG_KEY, {
    host: env.NEXT_PUBLIC_POSTHOG_HOST,
    personalApiKey: env.POSTHOG_PERSONAL_API_KEY,
    flushAt: 1,
    flushInterval: 0,
  });
  try {
    const result = await client.getFeatureFlag(key, ctx.userId, {
      groups: ctx.companyId ? { company: ctx.companyId } : undefined,
    });
    if (result === undefined || result === null) return false;
    return result;
  } catch {
    return false;
  } finally {
    try {
      await client.shutdown();
    } catch {
      // ignore
    }
  }
}

/**
 * Resolve a feature flag for the given context. Returns a boolean for boolean
 * flags, or a string for PostHog multivariate flags.
 */
export async function getFlag(
  key: string,
  ctx: FlagContext = {},
): Promise<FlagValue> {
  const ck = cacheKey(key, ctx);
  const cached = cacheGet(ck);
  if (cached !== undefined) return cached;

  const fromDb = await resolveFromDb(key, ctx);
  const value = fromDb !== null ? fromDb : await resolveFromPostHog(key, ctx);

  cacheSet(ck, value);
  return value;
}

/** Boolean convenience wrapper — coerces multivariate results to truthiness. */
export async function isFlagEnabled(
  key: string,
  ctx: FlagContext = {},
): Promise<boolean> {
  const value = await getFlag(key, ctx);
  return value === true || (typeof value === "string" && value.length > 0);
}

/** Test/maintenance hook — clears the in-process cache. */
export function __clearFlagCache(): void {
  cache.clear();
}
