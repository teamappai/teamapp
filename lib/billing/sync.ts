import "server-only";
import type Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/service";
import { planFromPriceId, isExtraSeatPriceId } from "@/lib/billing/env";
import { getPlan, type PlanId, type BillingCycle } from "@/lib/billing/plans";
import type { Database } from "@/types/supabase";

type CompanyStatus = Database["public"]["Enums"]["company_status"];

/**
 * Translate a Stripe subscription into the fields we mirror on `companies`.
 * Plan/cycle are derived from the base line item; seats_total from the plan's
 * included seats + the extra-seat item quantity.
 */
export function deriveFromSubscription(sub: Stripe.Subscription): {
  plan: PlanId | null;
  cycle: BillingCycle | null;
  seatsTotal: number | null;
  status: CompanyStatus;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  cancellationScheduledFor: string | null;
} {
  let plan: PlanId | null = null;
  let cycle: BillingCycle | null = null;
  let extraSeats = 0;
  let periodEnd: number | null = null;

  for (const item of sub.items.data) {
    const priceId = item.price.id;
    const mapped = planFromPriceId(priceId);
    if (mapped) {
      plan = mapped.plan;
      cycle = mapped.cycle;
      // Period end lives on the item in current Stripe API versions.
      periodEnd = item.current_period_end ?? periodEnd;
    } else if (isExtraSeatPriceId(priceId)) {
      extraSeats = item.quantity ?? 0;
    }
  }

  const seatsTotal =
    plan != null ? getPlan(plan).included_seats + extraSeats : null;

  const cancelScheduled = sub.cancel_at_period_end === true;
  const status = mapStatus(sub, cancelScheduled);

  const iso = (s: number | null | undefined) =>
    s ? new Date(s * 1000).toISOString() : null;

  return {
    plan,
    cycle,
    seatsTotal,
    status,
    currentPeriodEnd: iso(periodEnd),
    trialEndsAt: iso(sub.trial_end),
    cancellationScheduledFor: cancelScheduled ? iso(periodEnd) : null,
  };
}

/** Map a Stripe subscription status (+ flags) to our company_status enum. */
export function mapStatus(
  sub: Stripe.Subscription,
  cancelScheduled: boolean,
): CompanyStatus {
  if (sub.pause_collection) return "paused";
  switch (sub.status) {
    case "trialing":
    case "incomplete":
      return "trialing";
    case "active":
      return cancelScheduled ? "cancellation_scheduled" : "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    case "paused":
      return "paused";
    default:
      return "active";
  }
}

/** Resolve the company id for a Stripe customer/subscription. */
export async function companyIdForSubscription(
  sub: Stripe.Subscription,
): Promise<string | null> {
  const service = createServiceClient();
  const metaId = sub.metadata?.company_id;
  if (metaId) return metaId;

  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const { data } = await service
    .from("companies")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return data?.id ?? null;
}

/** Resolve the company id for a Stripe customer id. */
export async function companyIdForCustomer(
  customerId: string | null,
): Promise<string | null> {
  if (!customerId) return null;
  const service = createServiceClient();
  const { data } = await service
    .from("companies")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * Mirror a Stripe subscription onto the matching `companies` row. Returns the
 * company id (or null when unmatched). Writes plan/cycle/seats/status/period.
 */
export async function reconcileSubscription(
  sub: Stripe.Subscription,
): Promise<string | null> {
  const companyId = await companyIdForSubscription(sub);
  if (!companyId) return null;

  const d = deriveFromSubscription(sub);
  const service = createServiceClient();

  const update: Database["public"]["Tables"]["companies"]["Update"] = {
    stripe_subscription_id: sub.id,
    status: d.status,
    current_period_end: d.currentPeriodEnd,
    trial_ends_at: d.trialEndsAt,
    cancellation_scheduled_for: d.cancellationScheduledFor,
  };
  if (d.plan) update.plan = d.plan;
  if (d.cycle) update.billing_cycle = d.cycle;
  if (d.seatsTotal != null) update.seats_total = d.seatsTotal;

  await service.from("companies").update(update).eq("id", companyId);
  return companyId;
}
