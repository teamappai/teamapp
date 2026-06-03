import posthog from "posthog-js";

import type { EventMap, EventName } from "./types";

/**
 * Browser-side PostHog access (Phase 15). Re-exports the singleton plus a typed
 * `capture` wrapper so call sites get compile-time checking of event names and
 * property shapes against the taxonomy in `lib/posthog/types.ts`.
 *
 * `posthog.init` is performed once in `components/posthog-provider.tsx`. Calls
 * made before init (or when PostHog is unconfigured) are buffered/no-op'd by the
 * SDK, so helpers here never guard for "is it ready".
 */

/**
 * Type-safe event capture. Prefer this over calling `posthog.capture` directly
 * — it forces the event name to be one of the 27 known events and the payload to
 * match that event's property type.
 */
export function capture<E extends EventName>(
  event: E,
  properties: EventMap[E],
): void {
  posthog.capture(event, properties);
}

/** Re-export the singleton for identify/group/reset and feature-flag reads. */
export default posthog;
