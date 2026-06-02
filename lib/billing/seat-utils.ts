import { getPlan, type PlanId } from "@/lib/billing/plans";

/**
 * Pure seat helpers — safe to import from client components (no server-only
 * deps). The data-fetching counterpart (getSeatUsage) lives in
 * `lib/billing/seats.ts` and re-exports these for server callers.
 */

/** Color band for the seat-usage meter (audit F-094). */
export type SeatBand = "ok" | "warn" | "critical";
export function seatBand(pct: number): SeatBand {
  if (pct >= 90) return "critical";
  if (pct >= 70) return "warn";
  return "ok";
}

/**
 * The next plan up that has more included seats, for the "upgrade instead of
 * adding seats" prompt. Returns null when already on the top self-serve plan.
 */
export function nextPlanUp(plan: PlanId): PlanId | null {
  if (plan === "launch") return "pro";
  if (plan === "pro") return "enterprise";
  return null;
}

/** Per-seat monthly cost for the current plan, in cents (0 for enterprise). */
export function perSeatMonthlyCents(plan: PlanId): number {
  return getPlan(plan).additional_seat_price_cents;
}
