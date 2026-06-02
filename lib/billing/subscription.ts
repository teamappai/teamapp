import "server-only";
import type Stripe from "stripe";
import { getStripe } from "@/lib/billing/stripe";
import {
  basePriceId,
  extraSeatPriceId,
  planFromPriceId,
} from "@/lib/billing/env";
import { createServiceClient } from "@/lib/supabase/service";
import {
  type PlanId,
  type BillingCycle,
  extraSeats,
} from "@/lib/billing/plans";

/**
 * Stripe subscription operations (Phase 12). All proration is left to Stripe's
 * defaults (`create_prorations`) for mid-period upgrades/seat changes;
 * downgrades are scheduled for period-end via Subscription Schedules so they
 * never take effect mid-period (Decision 5 — A).
 *
 * Per-seat billing: every subscription carries a base item (quantity 1, flat
 * price) plus an extra-seat item whose quantity = seats beyond the plan's
 * included allotment. Extra seats always bill monthly, even on annual plans.
 */

/** Find-or-create the Stripe customer for a company and persist its id. */
export async function ensureCustomer(args: {
  companyId: string;
  companyName: string;
  email: string;
  existingCustomerId: string | null;
}): Promise<string> {
  const stripe = getStripe();
  if (args.existingCustomerId) return args.existingCustomerId;

  const customer = await stripe.customers.create({
    name: args.companyName,
    email: args.email,
    metadata: { company_id: args.companyId },
  });

  const service = createServiceClient();
  await service
    .from("companies")
    .update({ stripe_customer_id: customer.id })
    .eq("id", args.companyId);

  return customer.id;
}

/** Desired Stripe line items for a plan/cycle/seat count. */
export function desiredItems(
  plan: PlanId,
  cycle: BillingCycle,
  seatsTotal: number,
): { price: string; quantity: number }[] {
  const items = [{ price: basePriceId(plan, cycle), quantity: 1 }];
  const extra = extraSeats(plan, seatsTotal);
  if (extra > 0) items.push({ price: extraSeatPriceId(plan), quantity: extra });
  return items;
}

/** Create a brand-new subscription (initial signup / first paid plan). */
export async function createSubscription(args: {
  customerId: string;
  companyId: string;
  plan: PlanId;
  cycle: BillingCycle;
  seatsTotal: number;
  trialDays?: number;
}): Promise<Stripe.Subscription> {
  const stripe = getStripe();
  return stripe.subscriptions.create({
    customer: args.customerId,
    items: desiredItems(args.plan, args.cycle, args.seatsTotal),
    trial_period_days: args.trialDays,
    proration_behavior: "create_prorations",
    payment_behavior: "default_incomplete",
    metadata: { company_id: args.companyId, plan: args.plan },
    expand: ["latest_invoice.payment_intent"],
  });
}

/**
 * Reconcile an existing subscription's items to the target plan/cycle/seats and
 * apply proration immediately (used for upgrades and seat changes). Updates the
 * base item's price and the extra-seat item's quantity, adding/removing items
 * as needed.
 */
export async function applyPlanAndSeats(args: {
  subscriptionId: string;
  companyId: string;
  plan: PlanId;
  cycle: BillingCycle;
  seatsTotal: number;
}): Promise<Stripe.Subscription> {
  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(args.subscriptionId);

  const targetBase = basePriceId(args.plan, args.cycle);
  const targetSeatPrice = extraSeatPriceId(args.plan);
  const targetExtra = extraSeats(args.plan, args.seatsTotal);

  const items: Stripe.SubscriptionUpdateParams.Item[] = [];

  // Classify the existing items: which is the base, which is the extra-seat.
  let baseItem: Stripe.SubscriptionItem | undefined;
  let seatItem: Stripe.SubscriptionItem | undefined;
  for (const item of sub.items.data) {
    const priceId = item.price.id;
    const mapped = planFromPriceId(priceId);
    if (mapped) baseItem = item;
    else seatItem = item;
  }

  // Base item: update price (covers plan switch + cycle switch).
  if (baseItem) {
    items.push({ id: baseItem.id, price: targetBase, quantity: 1 });
  } else {
    items.push({ price: targetBase, quantity: 1 });
  }

  // Extra-seat item: set quantity, or delete it when no extra seats remain.
  if (seatItem) {
    if (targetExtra > 0) {
      items.push({
        id: seatItem.id,
        price: targetSeatPrice,
        quantity: targetExtra,
      });
    } else {
      items.push({ id: seatItem.id, deleted: true });
    }
  } else if (targetExtra > 0) {
    items.push({ price: targetSeatPrice, quantity: targetExtra });
  }

  return stripe.subscriptions.update(args.subscriptionId, {
    items,
    proration_behavior: "create_prorations",
    metadata: { company_id: args.companyId, plan: args.plan },
  });
}

/**
 * Schedule a downgrade (or any change) to take effect at period end via a
 * Subscription Schedule, leaving the current plan untouched until renewal
 * (Decision 5 — A). Returns the created schedule.
 */
export async function scheduleAtPeriodEnd(args: {
  subscriptionId: string;
  companyId: string;
  plan: PlanId;
  cycle: BillingCycle;
  seatsTotal: number;
}): Promise<Stripe.SubscriptionSchedule> {
  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(args.subscriptionId);

  // Create a schedule from the live subscription, then append a phase that
  // begins at the current period end with the new configuration.
  const schedule = await stripe.subscriptionSchedules.create({
    from_subscription: args.subscriptionId,
  });

  const currentPhase = schedule.phases[0];
  const periodEnd =
    sub.items.data[0]?.current_period_end ?? currentPhase.end_date;

  // Phase 0: keep the current plan untouched until the period end.
  // Phase 1 (open-ended): the new, downgraded configuration takes over then.
  return stripe.subscriptionSchedules.update(schedule.id, {
    end_behavior: "release",
    phases: [
      {
        items: currentPhase.items.map((i) => ({
          price: typeof i.price === "string" ? i.price : i.price.id,
          quantity: i.quantity ?? 1,
        })),
        start_date: currentPhase.start_date,
        end_date: periodEnd,
      },
      {
        items: desiredItems(args.plan, args.cycle, args.seatsTotal),
        metadata: { company_id: args.companyId, plan: args.plan },
      },
    ],
  });
}

/** Pause collection for ~30 days (Decision 6 save-flow option 1). */
export async function pauseSubscription(
  subscriptionId: string,
  resumesAt?: number,
): Promise<Stripe.Subscription> {
  const stripe = getStripe();
  return stripe.subscriptions.update(subscriptionId, {
    pause_collection: { behavior: "void", resumes_at: resumesAt },
  });
}

/** Resume a paused subscription. */
export async function resumeSubscription(
  subscriptionId: string,
): Promise<Stripe.Subscription> {
  const stripe = getStripe();
  return stripe.subscriptions.update(subscriptionId, {
    pause_collection: "",
  });
}

/** Schedule cancellation at period end (default cancel flow). */
export async function cancelAtPeriodEnd(
  subscriptionId: string,
): Promise<Stripe.Subscription> {
  const stripe = getStripe();
  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
}

/** Undo a scheduled cancellation. */
export async function uncancel(
  subscriptionId: string,
): Promise<Stripe.Subscription> {
  const stripe = getStripe();
  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
  });
}

/** Extend a trial by N days from its current end (super-admin override). */
export async function extendTrial(
  subscriptionId: string,
  days: number,
): Promise<Stripe.Subscription> {
  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const base = sub.trial_end ? sub.trial_end : Math.floor(Date.now() / 1000);
  return stripe.subscriptions.update(subscriptionId, {
    trial_end: base + days * 24 * 60 * 60,
    proration_behavior: "none",
  });
}

/** Apply a credit (negative customer balance) via a credit note-style adjustment. */
export async function applyCredit(args: {
  customerId: string;
  amountCents: number;
  reason: string;
}): Promise<Stripe.CustomerBalanceTransaction> {
  const stripe = getStripe();
  return stripe.customers.createBalanceTransaction(args.customerId, {
    amount: -Math.abs(Math.round(args.amountCents)),
    currency: "usd",
    description: args.reason,
  });
}
