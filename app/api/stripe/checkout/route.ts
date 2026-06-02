import { NextResponse, type NextRequest } from "next/server";
import { getStripe } from "@/lib/billing/stripe";
import { isStripeConfigured } from "@/lib/billing/env";
import { requireTeamLead } from "@/lib/auth/require-team-lead";
import { NotAuthorizedError } from "@/lib/auth/require-super-admin";
import { ensureCustomer, desiredItems } from "@/lib/billing/subscription";
import { getCompany } from "@/lib/billing/state";
import {
  PLAN_ORDER,
  SELF_SERVE_PLANS,
  type PlanId,
  type BillingCycle,
} from "@/lib/billing/plans";

/**
 * Create a Stripe Checkout session for the initial paid subscription (card
 * required, 14-day trial — Decision 2 — B). Returns { url } to redirect to.
 * Plan switches for existing subscriptions go through the in-app upgrade flow,
 * not Checkout.
 */
export const runtime = "nodejs";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const TRIAL_DAYS = 14;

export async function POST(req: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe not configured" },
      { status: 503 },
    );
  }

  let ctx;
  try {
    ctx = await requireTeamLead();
  } catch (err) {
    if (err instanceof NotAuthorizedError) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    throw err;
  }
  if (!ctx.companyId) {
    return NextResponse.json({ error: "No company" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    plan?: string;
    cycle?: string;
    seats?: number;
  };
  const plan = body.plan as PlanId;
  const cycle = (body.cycle as BillingCycle) ?? "monthly";
  if (!PLAN_ORDER.includes(plan) || !SELF_SERVE_PLANS.includes(plan)) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const company = await getCompany(ctx.companyId);
  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const customerId = await ensureCustomer({
    companyId: company.id,
    companyName: company.name,
    email: ctx.profile.email,
    existingCustomerId: company.stripe_customer_id,
  });

  const seats = Math.max(
    company.seats_total,
    body.seats ?? company.seats_total,
  );
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: desiredItems(plan, cycle, seats),
    subscription_data: {
      trial_period_days: TRIAL_DAYS,
      metadata: { company_id: company.id, plan },
    },
    success_url: `${APP_URL}/app/billing?checkout=success`,
    cancel_url: `${APP_URL}/app/billing?checkout=cancelled`,
  });

  return NextResponse.json({ url: session.url });
}
