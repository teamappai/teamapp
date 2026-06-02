"use server";

import { revalidatePath } from "next/cache";
import { requireTeamLead } from "@/lib/auth/require-team-lead";
import { NotAuthorizedError } from "@/lib/auth/require-super-admin";
import { logAudit } from "@/lib/audit/log";
import {
  getCompany,
  listInvoices,
  type InvoiceSummary,
} from "@/lib/billing/state";
import { getSeatUsage } from "@/lib/billing/seats";
import {
  applyPlanAndSeats,
  scheduleAtPeriodEnd,
  pauseSubscription,
  resumeSubscription,
} from "@/lib/billing/subscription";
import { reconcileSubscription } from "@/lib/billing/sync";
import { isStripeConfigured } from "@/lib/billing/env";
import { getStripe } from "@/lib/billing/stripe";
import {
  getPlan,
  planRank,
  type PlanId,
  type BillingCycle,
} from "@/lib/billing/plans";
import {
  emailPlanUpgraded,
  emailPlanDowngraded,
  emailSubscriptionPaused,
} from "@/lib/email/billing";

export type BillingActionResult =
  | { ok: true; message?: string }
  | { ok: true; message?: string; needsCheckout: true }
  | { ok: false; error: string };

type Ctx = {
  actorId: string;
  companyId: string;
  email: string;
};

async function guard(
  fn: (ctx: Ctx) => Promise<BillingActionResult>,
): Promise<BillingActionResult> {
  let ctx;
  try {
    ctx = await requireTeamLead();
  } catch (err) {
    if (err instanceof NotAuthorizedError) {
      return { ok: false, error: "Not authorized." };
    }
    throw err;
  }
  if (!ctx.companyId) {
    return {
      ok: false,
      error: "Super admins manage billing from the admin console.",
    };
  }
  if (!isStripeConfigured()) {
    return {
      ok: false,
      error: "Billing is not configured yet. Contact support.",
    };
  }
  try {
    return await fn({
      actorId: ctx.profile.id,
      companyId: ctx.companyId,
      email: ctx.profile.email,
    });
  } catch (err) {
    console.error("[billing action] unexpected error:", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

function refresh() {
  revalidatePath("/app/billing");
}

/**
 * Upgrade or change seats on the current subscription (immediate, prorated).
 * For a higher-ranked plan this is an upgrade; same plan with more seats is a
 * seat add. Downgrades (lower rank) must use `scheduleDowngrade` instead.
 */
export async function changePlan(input: {
  plan: PlanId;
  cycle: BillingCycle;
  seats: number;
}): Promise<BillingActionResult> {
  return guard(async (ctx) => {
    if (input.plan === "enterprise") {
      return {
        ok: false,
        error: "Enterprise is sales-managed — contact sales.",
      };
    }
    const company = await getCompany(ctx.companyId);
    if (!company) return { ok: false, error: "Company not found." };

    const currentPlan = company.plan as PlanId;
    if (planRank(input.plan) < planRank(currentPlan)) {
      return {
        ok: false,
        error: "Use the scheduled downgrade flow to move to a lower plan.",
      };
    }

    // No live subscription yet → send them through Checkout to add a card.
    if (!company.stripe_subscription_id) {
      return { ok: true, needsCheckout: true };
    }

    const seats = Math.max(input.seats, getPlan(input.plan).included_seats);
    const sub = await applyPlanAndSeats({
      subscriptionId: company.stripe_subscription_id,
      companyId: ctx.companyId,
      plan: input.plan,
      cycle: input.cycle,
      seatsTotal: seats,
    });
    await reconcileSubscription(sub);

    const isUpgrade = planRank(input.plan) > planRank(currentPlan);
    await logAudit({
      actor_user_id: ctx.actorId,
      action: isUpgrade ? "plan_upgraded" : "seats_changed",
      resource_type: "subscription",
      resource_id: ctx.companyId,
      metadata: { plan: input.plan, cycle: input.cycle, seats },
    });
    if (isUpgrade) {
      await emailPlanUpgraded({
        to: ctx.email,
        planName: getPlan(input.plan).display_name,
      });
    }

    refresh();
    return {
      ok: true,
      message: isUpgrade
        ? `Upgraded to ${getPlan(input.plan).display_name}.`
        : `Seats updated to ${seats}.`,
    };
  });
}

/** Schedule a downgrade for period end (Decision 5 — A). Blocks on seat usage. */
export async function scheduleDowngrade(input: {
  plan: PlanId;
  cycle: BillingCycle;
  seats: number;
}): Promise<BillingActionResult> {
  return guard(async (ctx) => {
    if (input.plan === "enterprise") {
      return {
        ok: false,
        error: "Enterprise is sales-managed — contact sales.",
      };
    }
    const company = await getCompany(ctx.companyId);
    if (!company) return { ok: false, error: "Company not found." };
    if (!company.stripe_subscription_id) {
      return { ok: false, error: "No active subscription to change." };
    }

    const targetSeats = Math.max(
      input.seats,
      getPlan(input.plan).included_seats,
    );
    const usage = await getSeatUsage(ctx.companyId, targetSeats);
    if (usage.used > targetSeats) {
      return {
        ok: false,
        error: `You have ${usage.used} active users but ${getPlan(input.plan).display_name} would include ${targetSeats} seats. Reduce to ${targetSeats} active users first, or stay on your current plan.`,
      };
    }

    await scheduleAtPeriodEnd({
      subscriptionId: company.stripe_subscription_id,
      companyId: ctx.companyId,
      plan: input.plan,
      cycle: input.cycle,
      seatsTotal: targetSeats,
    });

    const effective = company.current_period_end ?? new Date().toISOString();
    await logAudit({
      actor_user_id: ctx.actorId,
      action: "downgrade_scheduled",
      resource_type: "subscription",
      resource_id: ctx.companyId,
      metadata: { plan: input.plan, effective },
    });
    await emailPlanDowngraded({
      to: ctx.email,
      planName: getPlan(input.plan).display_name,
      effectiveDate: effective,
    });

    refresh();
    return { ok: true, message: "Downgrade scheduled." };
  });
}

/** Pause collection for 30 days (save-flow option). */
export async function pauseSubscriptionAction(): Promise<BillingActionResult> {
  return guard(async (ctx) => {
    const company = await getCompany(ctx.companyId);
    if (!company?.stripe_subscription_id) {
      return { ok: false, error: "No active subscription to pause." };
    }
    const resumesAt = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
    const sub = await pauseSubscription(
      company.stripe_subscription_id,
      resumesAt,
    );
    await reconcileSubscription(sub);
    await logAudit({
      actor_user_id: ctx.actorId,
      action: "subscription_paused",
      resource_type: "subscription",
      resource_id: ctx.companyId,
      metadata: { resumes_at: new Date(resumesAt * 1000).toISOString() },
    });
    await emailSubscriptionPaused({
      to: ctx.email,
      resumeDate: new Date(resumesAt * 1000),
    });
    refresh();
    return { ok: true, message: "Your subscription is paused for 30 days." };
  });
}

/** Resume a paused subscription. */
export async function resumeSubscriptionAction(): Promise<BillingActionResult> {
  return guard(async (ctx) => {
    const company = await getCompany(ctx.companyId);
    if (!company?.stripe_subscription_id) {
      return { ok: false, error: "No subscription to resume." };
    }
    const sub = await resumeSubscription(company.stripe_subscription_id);
    await reconcileSubscription(sub);
    await logAudit({
      actor_user_id: ctx.actorId,
      action: "subscription_resumed",
      resource_type: "subscription",
      resource_id: ctx.companyId,
    });
    refresh();
    return { ok: true, message: "Subscription resumed." };
  });
}

/** Fetch a page of invoices for the history tab (client pagination). */
export async function fetchInvoicesPage(
  startingAfter?: string,
): Promise<
  { invoices: InvoiceSummary[]; hasMore: boolean } | { error: string }
> {
  let ctx;
  try {
    ctx = await requireTeamLead();
  } catch (err) {
    if (err instanceof NotAuthorizedError) return { error: "Not authorized." };
    throw err;
  }
  if (!ctx.companyId) return { error: "No company." };
  const company = await getCompany(ctx.companyId);
  return listInvoices(company?.stripe_customer_id ?? null, { startingAfter });
}

/** Build a CSV of all invoices for download (Export all). */
export async function exportInvoicesCsv(): Promise<
  { ok: true; csv: string } | { ok: false; error: string }
> {
  let ctx;
  try {
    ctx = await requireTeamLead();
  } catch (err) {
    if (err instanceof NotAuthorizedError)
      return { ok: false, error: "Not authorized." };
    throw err;
  }
  if (!ctx.companyId) return { ok: false, error: "No company." };
  if (!isStripeConfigured())
    return { ok: false, error: "Billing not configured." };

  const company = await getCompany(ctx.companyId);
  const customerId = company?.stripe_customer_id;
  if (!customerId) return { ok: true, csv: "Date,Number,Amount,Status\n" };

  const stripe = getStripe();
  const rows: string[] = ["Date,Number,Amount,Status"];
  let startingAfter: string | undefined;
  // Bounded loop so an enormous history can't run unbounded.
  for (let page = 0; page < 20; page++) {
    const list = await stripe.invoices.list({
      customer: customerId,
      limit: 100,
      starting_after: startingAfter,
    });
    for (const inv of list.data) {
      const date = new Date(inv.created * 1000).toISOString().slice(0, 10);
      const amount = ((inv.amount_paid || inv.total || 0) / 100).toFixed(2);
      rows.push(`${date},${inv.number ?? ""},${amount},${inv.status ?? ""}`);
    }
    if (!list.has_more) break;
    startingAfter = list.data[list.data.length - 1]?.id;
  }
  return { ok: true, csv: rows.join("\n") };
}
