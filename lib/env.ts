import { z } from "zod";

/**
 * Centralised, lazily-validated environment access (Phase 15).
 *
 * Unlike `lib/billing/env.ts` (server-only Stripe secrets), the PostHog config
 * is split: the project key + host are `NEXT_PUBLIC_` (inlined into the client
 * bundle), while the Personal API Key used for server-side feature-flag reads is
 * server-only. Validation is lazy and NON-throwing at module load — analytics is
 * optional infrastructure, so a missing key must degrade gracefully (skip init)
 * rather than crash the app. Use the `is*Configured()` guards before init.
 */

const clientSchema = z.object({
  NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().url(),
});

const serverSchema = clientSchema.extend({
  POSTHOG_PERSONAL_API_KEY: z.string().min(1),
});

export type PostHogClientEnv = z.infer<typeof clientSchema>;
export type PostHogServerEnv = z.infer<typeof serverSchema>;

/**
 * Read the public PostHog config. Returns null when unconfigured so the browser
 * provider can no-op cleanly in dev/test environments without the key set.
 *
 * NB: `NEXT_PUBLIC_*` vars are statically inlined by Next at build time, so they
 * must be referenced as explicit property accesses (not `process.env[key]`).
 */
export function posthogClientEnv(): PostHogClientEnv | null {
  const parsed = clientSchema.safeParse({
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  });
  return parsed.success ? parsed.data : null;
}

/** True when the public client config (key + host) is present and valid. */
export function isPostHogConfigured(): boolean {
  return posthogClientEnv() !== null;
}

/**
 * Read the server PostHog config (adds the Personal API Key). Returns null when
 * unconfigured so the flag resolver can fall back to its default.
 */
export function posthogServerEnv(): PostHogServerEnv | null {
  const parsed = serverSchema.safeParse({
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    POSTHOG_PERSONAL_API_KEY: process.env.POSTHOG_PERSONAL_API_KEY,
  });
  return parsed.success ? parsed.data : null;
}

/** True when server-side feature-flag reads can reach PostHog. */
export function isPostHogServerConfigured(): boolean {
  return posthogServerEnv() !== null;
}
