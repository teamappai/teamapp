/**
 * Canonical TeamApp pricing — the SINGLE SOURCE OF TRUTH.
 *
 * All pricing displays in marketing, app billing UI, Stripe products, and
 * analytics MUST read from this file. Hardcoding prices anywhere else is a bug.
 *
 * Money is stored as integer cents everywhere (never floats). Stripe price IDs
 * are null until Phase 12 wires up Stripe products.
 */

export type PlanId = "launch" | "pro" | "brokerage";
export type BillingCycle = "monthly" | "annual";

export interface Plan {
  id: PlanId;
  display_name: string;
  tagline: string;
  /** Base subscription price per month, in cents. */
  monthly_price_cents: number;
  /** Base subscription price for a full year (paid annually), in cents. */
  annual_price_cents: number;
  /** Seats bundled into the base price. */
  included_seats: number;
  /** Price per additional seat per month (monthly billing), in cents. */
  additional_seat_price_cents: number;
  /** Price per additional seat for a full year (annual billing), in cents. */
  additional_seat_annual_price_cents: number;
  /** Stripe price IDs — populated in Phase 12. */
  stripe_monthly_price_id: string | null;
  stripe_annual_price_id: string | null;
  stripe_additional_seat_monthly_price_id: string | null;
  stripe_additional_seat_annual_price_id: string | null;
}

export const PLANS: Record<PlanId, Plan> = {
  launch: {
    id: "launch",
    display_name: "Launch",
    tagline: "For new teams getting off the ground.",
    monthly_price_cents: 25_000, // $250/mo
    annual_price_cents: 240_000, // $240/mo × 12 = $2,400 (20% off)
    included_seats: 10,
    additional_seat_price_cents: 2_500, // $25/seat/mo
    additional_seat_annual_price_cents: 24_000, // $20/seat/mo × 12 = $240 (20% off)
    stripe_monthly_price_id: null,
    stripe_annual_price_id: null,
    stripe_additional_seat_monthly_price_id: null,
    stripe_additional_seat_annual_price_id: null,
  },
  pro: {
    id: "pro",
    display_name: "Pro",
    tagline: "For growing teams that need more seats and structure.",
    monthly_price_cents: 59_500, // $595/mo
    annual_price_cents: 571_200, // $476/mo × 12 = $5,712 (20% off)
    included_seats: 25,
    additional_seat_price_cents: 1_500, // $15/seat/mo
    additional_seat_annual_price_cents: 14_400, // $12/seat/mo × 12 = $144 (20% off)
    stripe_monthly_price_id: null,
    stripe_annual_price_id: null,
    stripe_additional_seat_monthly_price_id: null,
    stripe_additional_seat_annual_price_id: null,
  },
  brokerage: {
    id: "brokerage",
    display_name: "Brokerage",
    tagline: "For brokerages running many agents at scale.",
    monthly_price_cents: 150_000, // $1,500/mo
    annual_price_cents: 1_440_000, // $1,200/mo × 12 = $14,400 (20% off)
    included_seats: 100,
    additional_seat_price_cents: 1_000, // $10/seat/mo
    additional_seat_annual_price_cents: 9_600, // $8/seat/mo × 12 = $96 (20% off)
    stripe_monthly_price_id: null,
    stripe_annual_price_id: null,
    stripe_additional_seat_monthly_price_id: null,
    stripe_additional_seat_annual_price_id: null,
  },
};

/** Ordered list of plans for display (cheapest → most expensive). */
export const PLAN_ORDER: readonly PlanId[] = ["launch", "pro", "brokerage"];

/** Look up a plan by id. */
export function getPlan(id: PlanId): Plan {
  return PLANS[id];
}

/**
 * Total price in CENTS for a plan at a given billing cycle and seat count.
 * Seats at or below the plan's included_seats incur no per-seat charge;
 * seats beyond that are billed at the cycle's additional-seat rate.
 */
export function calculatePrice(
  planId: PlanId,
  cycle: BillingCycle,
  seats: number,
): number {
  const plan = getPlan(planId);
  const base =
    cycle === "annual" ? plan.annual_price_cents : plan.monthly_price_cents;
  const extraSeats = Math.max(0, Math.ceil(seats) - plan.included_seats);
  const seatRate =
    cycle === "annual"
      ? plan.additional_seat_annual_price_cents
      : plan.additional_seat_price_cents;
  return base + extraSeats * seatRate;
}

/**
 * Format integer cents as a human-readable USD string.
 * Whole-dollar amounts omit decimals ("$250"); otherwise two decimals
 * ("$250.50"). Integer math only — no floating point.
 */
export function formatPrice(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const whole = Math.trunc(abs / 100);
  const frac = abs % 100;
  const wholeStr = whole.toLocaleString("en-US");
  const body =
    frac === 0 ? wholeStr : `${wholeStr}.${String(frac).padStart(2, "0")}`;
  return `${negative ? "-" : ""}$${body}`;
}

/**
 * Actual annual discount versus paying 12× the monthly price, as a percentage
 * (e.g. 20 for "20% off"). Rounded to one decimal place.
 */
export function annualDiscountPct(plan: Plan): number {
  const monthlyForYear = plan.monthly_price_cents * 12;
  if (monthlyForYear === 0) return 0;
  const pct = (1 - plan.annual_price_cents / monthlyForYear) * 100;
  return Math.round(pct * 10) / 10;
}
