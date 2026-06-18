import type { BrowserOptions, NodeOptions } from "@sentry/nextjs";
import { scrubEvent } from "@/lib/sentry/scrub";

/**
 * Base Sentry init options shared by the client, server, and edge runtimes
 * (Phase 16B, Decision 1). DSN is read from `NEXT_PUBLIC_SENTRY_DSN` — never
 * hardcoded. When the DSN is absent (e.g. local dev without it set) the SDK
 * no-ops, so this is safe to call unconditionally.
 */
export const baseSentryOptions: BrowserOptions & NodeOptions = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Environment + release for triage. NODE_ENV is the safe default; override via
  // SENTRY_ENVIRONMENT in deployed environments if you want finer buckets.
  environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,

  // PII safety (Decision 1): keep Sentry's default off so it never attaches IPs,
  // cookies, or request bodies, and run our own scrubber as a second pass.
  sendDefaultPii: false,
  beforeSend: scrubEvent,

  // Modest tracing; tuneable via env without a code change.
  tracesSampleRate: process.env.SENTRY_TRACES_SAMPLE_RATE
    ? Number(process.env.SENTRY_TRACES_SAMPLE_RATE)
    : 0.1,

  // No Session Replay / DOM capture — PostHog owns session replay, and replay
  // would risk capturing client names, message contents, etc.
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
};
