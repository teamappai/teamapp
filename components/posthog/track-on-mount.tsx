"use client";

import { useEffect, useRef } from "react";
import { capture } from "@/lib/posthog/client";
import type { EventMap, EventName } from "@/lib/posthog/types";

/**
 * Fire-and-forget client tracker for "page/section viewed" style events
 * (Phase 15). Server components render this with a typed event + properties and
 * it captures exactly once on mount (StrictMode-safe via a ref guard).
 *
 * Typed: TS enforces that `properties` matches the named event's shape from the
 * taxonomy, so a server component can't drift from the contract.
 */
export function TrackOnMount<E extends EventName>({
  event,
  properties,
}: {
  event: E;
  properties: EventMap[E];
}) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    capture(event, properties);
    // properties is a stable server-serialized object for this render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
