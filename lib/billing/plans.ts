/**
 * Canonical TeamApp pricing — the SINGLE SOURCE OF TRUTH.
 *
 * All pricing displays in marketing, app billing UI, Stripe products, and
 * analytics MUST read from this file. Hardcoding prices anywhere else is a bug.
 *
 * Money is stored as integer cents everywhere (never floats).
 *
 * Stripe price IDs are intentionally NOT here — they are server-only secrets
 * read from the environment in `lib/billing/price-map.ts` (server-only). This
 * file is safe to import from client components.
 *
 * Phase 12 canonical structure:
 *   • Launch — $245/mo, 5 seats, +$25/seat/mo. Annual $2,450/yr ("2 months
 *     free" → $204/mo equivalent), +$250/seat/yr.
 *   • Pro — $595/mo, 25 seats, +$20/seat/mo. Annual $5,950/yr ("2 months
 *     free" → $496/mo equivalent), +$200/seat/yr.
 *   • Enterprise — custom pricing (sales-managed), 50+ seats, no Stripe price.
 */

export type PlanId = "launch" | "pro" | "enterprise";
export type BillingCycle = "monthly" | "annual";

export interface Plan {
  id: PlanId;
  display_name: string;
  tagline: string;
  /** Enterprise is sales-managed: no self-serve price, render "Custom pricing". */
  custom: boolean;
  /** Suggested fit blurb (used by Enterprise). */
  fit?: string;
  /** Base subscription price per month, in cents. 0 for custom plans. */
  monthly_price_cents: number;
  /** Base subscription price for a full year (paid annually), in cents. */
  annual_price_cents: number;
  /** Seats bundled into the base price. */
  included_seats: number;
  /**
   * Price per additional seat per MONTH, in cents. Extra seats are ALWAYS
   * billed monthly and ALWAYS displayed monthly — even on an annual base plan
   * (industry standard: Notion/Linear/Figma). There is no annual seat figure on
   * purpose: "$250/seat/year" reads as sticker shock vs the identical
   * "$25/seat/month" and dampens our primary expansion lever.
   */
  additional_seat_price_cents: number;
}

export const PLANS: Record<PlanId, Plan> = {
  launch: {
    id: "launch",
    display_name: "Launch",
    tagline: "For new teams getting off the ground.",
    custom: false,
    monthly_price_cents: 24_500, // $245/mo
    annual_price_cents: 245_000, // $2,450/yr = 10 × $245 (2 months free)
    included_seats: 5,
    additional_seat_price_cents: 2_500, // $25/seat/mo (always billed monthly)
  },
  pro: {
    id: "pro",
    display_name: "Pro",
    tagline: "For growing teams that need more seats and structure.",
    custom: false,
    monthly_price_cents: 59_500, // $595/mo
    annual_price_cents: 595_000, // $5,950/yr = 10 × $595 (2 months free)
    included_seats: 25,
    additional_seat_price_cents: 2_000, // $20/seat/mo (always billed monthly)
  },
  enterprise: {
    id: "enterprise",
    display_name: "Enterprise",
    tagline: "For brokerages running many teams at scale.",
    custom: true,
    fit: "50+ team members",
    monthly_price_cents: 0, // custom — sales contract
    annual_price_cents: 0,
    included_seats: 50,
    additional_seat_price_cents: 0,
  },
};

/** Ordered list of plans for display (cheapest → most expensive). */
export const PLAN_ORDER: readonly PlanId[] = ["launch", "pro", "enterprise"];

/** Plans that support self-serve Stripe checkout/upgrade (exclude Enterprise). */
export const SELF_SERVE_PLANS: readonly PlanId[] = ["launch", "pro"];

/** Look up a plan by id. */
export function getPlan(id: PlanId): Plan {
  return PLANS[id];
}

/** Rank a plan for upgrade/downgrade comparisons (launch < pro < enterprise). */
export function planRank(id: PlanId): number {
  return PLAN_ORDER.indexOf(id);
}

/**
 * Total recurring price in CENTS for a plan at a given billing cycle and seat
 * count. The base is annual or monthly per `cycle`; extra seats are ALWAYS
 * priced monthly (they bill monthly even on annual plans), so for an annual
 * base this returns a mixed-cadence figure — display the base and the monthly
 * seat overage separately rather than as one number.
 */
export function calculatePrice(
  planId: PlanId,
  cycle: BillingCycle,
  seats: number,
): number {
  const plan = getPlan(planId);
  const base =
    cycle === "annual" ? plan.annual_price_cents : plan.monthly_price_cents;
  return base + extraSeats(planId, seats) * plan.additional_seat_price_cents;
}

/** Number of additional (paid) seats beyond the plan's included allotment. */
export function extraSeats(planId: PlanId, seatsTotal: number): number {
  return Math.max(0, Math.ceil(seatsTotal) - getPlan(planId).included_seats);
}

/** Monthly cost in CENTS of the extra seats beyond the included allotment. */
export function extraSeatsMonthlyCents(
  planId: PlanId,
  seatsTotal: number,
): number {
  return (
    extraSeats(planId, seatsTotal) * getPlan(planId).additional_seat_price_cents
  );
}

/**
 * Per-month-equivalent of an annual plan, rounded to a whole dollar (in cents):
 * Launch → $204, Pro → $496. This is the headline figure shown on annual plan
 * cards ("$204/month, billed yearly").
 */
export function annualMonthlyEquivalentCents(plan: Plan): number {
  return Math.round(plan.annual_price_cents / 12 / 100) * 100;
}

/**
 * Format integer cents as a human-readable USD string. Symbol always on the
 * LEFT (audit F-101); whole-dollar amounts omit decimals ("$245"); otherwise
 * two decimals ("$245.50"). Integer math only — no floating point.
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
 * (e.g. 16.7 for the "2 months free" model). Rounded to one decimal place.
 */
export function annualDiscountPct(plan: Plan): number {
  const monthlyForYear = plan.monthly_price_cents * 12;
  if (monthlyForYear === 0) return 0;
  const pct = (1 - plan.annual_price_cents / monthlyForYear) * 100;
  return Math.round(pct * 10) / 10;
}
