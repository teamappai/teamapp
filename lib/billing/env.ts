import "server-only";
import { z } from "zod";
import type { PlanId, BillingCycle } from "@/lib/billing/plans";

/**
 * Server-only Stripe environment. Validated lazily (Next has no single startup
 * hook) the first time billing code touches Stripe, then cached. Missing/empty
 * vars fail fast with a clear, actionable error rather than a vague Stripe 401
 * deep in a webhook.
 *
 * Price IDs live here — NOT in lib/billing/plans.ts — because they are secrets
 * and plans.ts is imported by client components. Enterprise has no price ID
 * (sales-managed).
 */
const schema = z.object({
  STRIPE_SECRET_KEY: z.string().min(1, "STRIPE_SECRET_KEY is required"),
  STRIPE_WEBHOOK_SECRET: z.string().min(1, "STRIPE_WEBHOOK_SECRET is required"),
  STRIPE_PRICE_LAUNCH_MONTHLY: z.string().min(1),
  STRIPE_PRICE_LAUNCH_ANNUAL: z.string().min(1),
  STRIPE_PRICE_LAUNCH_EXTRA_SEAT: z.string().min(1),
  STRIPE_PRICE_PRO_MONTHLY: z.string().min(1),
  STRIPE_PRICE_PRO_ANNUAL: z.string().min(1),
  STRIPE_PRICE_PRO_EXTRA_SEAT: z.string().min(1),
});

export type StripeEnv = z.infer<typeof schema>;

let cached: StripeEnv | null = null;

/** Validate + return the Stripe env, throwing a single clear error if invalid. */
export function stripeEnv(): StripeEnv {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(
      `Stripe is not configured. Missing/invalid env var(s): ${missing}. ` +
        `Set them in .env.local (see .env.local.example).`,
    );
  }
  cached = parsed.data;
  return cached;
}

/** True when all required Stripe env vars are present (no throw). */
export function isStripeConfigured(): boolean {
  return schema.safeParse(process.env).success;
}

/**
 * Resolve the Stripe base Price ID for a self-serve plan + billing cycle.
 * Enterprise is sales-managed and has no price ID — callers must not reach here
 * for it.
 */
export function basePriceId(plan: PlanId, cycle: BillingCycle): string {
  const env = stripeEnv();
  if (plan === "launch") {
    return cycle === "annual"
      ? env.STRIPE_PRICE_LAUNCH_ANNUAL
      : env.STRIPE_PRICE_LAUNCH_MONTHLY;
  }
  if (plan === "pro") {
    return cycle === "annual"
      ? env.STRIPE_PRICE_PRO_ANNUAL
      : env.STRIPE_PRICE_PRO_MONTHLY;
  }
  throw new Error(`No Stripe price ID for plan "${plan}" (sales-managed).`);
}

/**
 * Resolve the per-seat (extra seat) Stripe Price ID for a self-serve plan.
 * Extra seats always bill monthly in v1 — even on annual base plans (a known,
 * accepted mixed-cadence simplification).
 */
export function extraSeatPriceId(plan: PlanId): string {
  const env = stripeEnv();
  if (plan === "launch") return env.STRIPE_PRICE_LAUNCH_EXTRA_SEAT;
  if (plan === "pro") return env.STRIPE_PRICE_PRO_EXTRA_SEAT;
  throw new Error(`No extra-seat Stripe price ID for plan "${plan}".`);
}

/** Reverse-map a Stripe base Price ID back to our plan + cycle (webhook reconcile). */
export function planFromPriceId(
  priceId: string,
): { plan: PlanId; cycle: BillingCycle } | null {
  if (!isStripeConfigured()) return null;
  const env = stripeEnv();
  const map: Record<string, { plan: PlanId; cycle: BillingCycle }> = {
    [env.STRIPE_PRICE_LAUNCH_MONTHLY]: { plan: "launch", cycle: "monthly" },
    [env.STRIPE_PRICE_LAUNCH_ANNUAL]: { plan: "launch", cycle: "annual" },
    [env.STRIPE_PRICE_PRO_MONTHLY]: { plan: "pro", cycle: "monthly" },
    [env.STRIPE_PRICE_PRO_ANNUAL]: { plan: "pro", cycle: "annual" },
  };
  return map[priceId] ?? null;
}

/** True if a Stripe Price ID is one of our extra-seat prices. */
export function isExtraSeatPriceId(priceId: string): boolean {
  if (!isStripeConfigured()) return false;
  const env = stripeEnv();
  return (
    priceId === env.STRIPE_PRICE_LAUNCH_EXTRA_SEAT ||
    priceId === env.STRIPE_PRICE_PRO_EXTRA_SEAT
  );
}
