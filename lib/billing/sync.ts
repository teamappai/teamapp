import "server-only";
import type Stripe from "stripe";
import { getStripe } from "@/lib/billing/stripe";
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
 * Whether a Stripe subscription status represents a *live* subscription — one
 * that can legitimately drive a company's billing mirror. Only `canceled` and
 * `incomplete_expired` are terminal/dead; everything else (trialing, active,
 * past_due, unpaid, paused, incomplete) is live.
 */
export function isLiveStatus(status: Stripe.Subscription.Status): boolean {
  return status !== "canceled" && status !== "incomplete_expired";
}

/** Result of a reconcile attempt. `applied` is false when the event was matched
 * to a company but intentionally skipped (stale/non-authoritative) or unmatched. */
export type ReconcileResult = {
  companyId: string | null;
  applied: boolean;
  status: CompanyStatus | null;
};

/** Is the stored subscription still live in Stripe? Missing/deleted → not live. */
async function isSubscriptionLive(subscriptionId: string): Promise<boolean> {
  const stripe = getStripe();
  try {
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    return isLiveStatus(sub.status);
  } catch {
    // Not found / unretrievable → treat as not live (so a real live sub can
    // adopt the mirror rather than being blocked by a dangling pointer).
    return false;
  }
}

/** Find an active/trialing subscription on the customer (active beats trialing). */
async function findActiveSubscriptionForCustomer(
  customerId: string,
  excludeId?: string,
): Promise<Stripe.Subscription | null> {
  const stripe = getStripe();
  const list = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 100,
  });
  const candidates = list.data.filter(
    (s) =>
      s.id !== excludeId && (s.status === "active" || s.status === "trialing"),
  );
  return (
    candidates.find((s) => s.status === "active") ??
    candidates.find((s) => s.status === "trialing") ??
    null
  );
}

/** Write the derived subscription fields onto the company row. */
async function writeMirror(
  companyId: string,
  sub: Stripe.Subscription,
): Promise<ReconcileResult> {
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
  return { companyId, applied: true, status: d.status };
}

/**
 * Mirror a Stripe subscription onto the matching `companies` row, but only when
 * the event's subscription is the company's *authoritative* one. A customer can
 * accumulate several subscriptions (e.g. re-subscribe after a cancel); stale
 * events for the non-tracked ones must not clobber the live pointer/status.
 *
 * Returns `{ companyId, applied, status }`: `applied` is true only when the
 * mirror was actually written, so callers can gate side-effects (emails, etc.).
 */
export async function reconcileSubscription(
  sub: Stripe.Subscription,
): Promise<ReconcileResult> {
  const companyId = await companyIdForSubscription(sub);
  if (!companyId) return { companyId: null, applied: false, status: null };

  const service = createServiceClient();
  const { data: company } = await service
    .from("companies")
    .select("stripe_subscription_id")
    .eq("id", companyId)
    .maybeSingle();

  const storedId = company?.stripe_subscription_id ?? null;
  const incomingId = sub.id;
  const incomingLive = isLiveStatus(sub.status);

  // GUARD A (critical): a dead subscription that is NOT the one we track must
  // never overwrite the live pointer/status. Stale canceled/expired events for
  // an old subscription are ignored entirely.
  if (storedId && incomingId !== storedId && !incomingLive) {
    return { companyId, applied: false, status: null };
  }

  // GUARD B (minimal): a *different* live subscription arrived. Adopt it only if
  // the stored one is no longer live; otherwise keep the existing one and log a
  // conflict. (The checkout guard prevents two live subs in normal operation.)
  if (storedId && incomingId !== storedId && incomingLive) {
    if (await isSubscriptionLive(storedId)) {
      console.warn(
        `[billing] two live subscriptions for company ${companyId}: keeping ${storedId}, ignoring ${incomingId}`,
      );
      return { companyId, applied: false, status: null };
    }
    // Stored sub is dead → fall through and adopt the incoming live sub.
  }

  // GUARD C (self-heal): the company's own tracked subscription is ending. If
  // the customer has another active/trialing subscription (a re-subscribe that
  // left the old one to cancel), re-point to it instead of recording a cancel.
  if (storedId && incomingId === storedId && !incomingLive) {
    const customerId =
      typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    const replacement = await findActiveSubscriptionForCustomer(
      customerId,
      incomingId,
    );
    if (replacement) return reconcileSubscription(replacement);
    // No replacement → genuine cancellation; fall through to write it.
  }

  // Normal path: first-ever sub (storedId null), an update to the tracked sub,
  // or a legitimate cancellation with no replacement.
  return writeMirror(companyId, sub);
}
