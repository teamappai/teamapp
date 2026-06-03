"use client";

import { capture } from "@/lib/posthog/client";
import type { EventMap, EventName } from "@/lib/posthog/types";

/**
 * Client click-tracker island (Phase 15). Lets a Server Component attach a typed
 * PostHog event to a clickable region without becoming a client component
 * itself. Renders a contents-only wrapper so it doesn't perturb layout.
 */
export function TrackClick<E extends EventName>({
  event,
  properties,
  children,
  className,
}: {
  event: E;
  properties: EventMap[E];
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={className ?? "contents"}
      onClick={() => capture(event, properties)}
    >
      {children}
    </div>
  );
}
