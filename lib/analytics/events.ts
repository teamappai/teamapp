import "server-only";

/**
 * Analytics event placeholder. Real wiring (PostHog) lands in Phase 15; for now
 * this records intent so the call sites are correct and greppable. The training
 * surface fires `training_module_viewed` and `training_module_completed`.
 */
export type AnalyticsEvent =
  | "training_module_viewed"
  | "training_module_completed";

export function trackEvent(
  event: AnalyticsEvent,
  properties: Record<string, unknown> = {},
): void {
  // Phase 15: forward to PostHog. Until then, a dev-only breadcrumb.
  if (process.env.NODE_ENV !== "production") {
    console.debug(`[analytics] ${event}`, properties);
  }
}
