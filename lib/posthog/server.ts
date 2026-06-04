import "server-only";
import { PostHog } from "posthog-node";

import { posthogClientEnv } from "@/lib/env";
import type { EventMap, EventName } from "./types";

/**
 * Server-side PostHog (Phase 15) for events that only the backend can witness —
 * deal submission, AI extraction results, request lifecycle, Stripe webhooks,
 * seat changes, nudges. Uses `posthog-node` with the same project key as the
 * browser SDK (the Personal API Key is reserved for feature-flag reads, see
 * `lib/flags`).
 *
 * Serverless concern (M1): the Node SDK batches by default, but a serverless
 * function may freeze/exit before the batch flushes. We therefore set
 * `flushAt: 1` / `flushInterval: 0` and ALWAYS `shutdown()` after a capture so
 * events are delivered before the request ends. `captureServer` encapsulates
 * the create → capture → shutdown lifecycle so call sites don't have to.
 */
export function getPostHogServer(): PostHog {
  const env = posthogClientEnv();
  // Caller is expected to guard with isPostHogConfigured(); fall back to the raw
  // env so a misconfigured deploy throws a clear PostHog error, not a TS crash.
  return new PostHog(
    env?.NEXT_PUBLIC_POSTHOG_KEY ?? process.env.NEXT_PUBLIC_POSTHOG_KEY!,
    {
      host:
        env?.NEXT_PUBLIC_POSTHOG_HOST ?? process.env.NEXT_PUBLIC_POSTHOG_HOST,
      flushAt: 1,
      flushInterval: 0,
    },
  );
}

/**
 * Capture a single server-side event and flush before returning. A no-op (and
 * never throws) when PostHog is unconfigured or delivery fails — analytics must
 * never break a server action. Pass `groups: { company: companyId }` to attach
 * the event to the company group for multi-tenant cohort analysis.
 */
export async function captureServer<E extends EventName>(
  event: E,
  properties: EventMap[E],
  distinctId: string,
  groups?: Record<string, string>,
): Promise<void> {
  if (!posthogClientEnv()) return;
  const client = getPostHogServer();
  try {
    client.capture({
      distinctId,
      event,
      properties,
      groups,
    });
  } catch {
    // Swallow — instrumentation is best-effort and must not surface to users.
  } finally {
    try {
      await client.shutdown();
    } catch {
      // ignore flush errors
    }
  }
}
