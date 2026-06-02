import { NextResponse } from "next/server";
import { getStripe } from "@/lib/billing/stripe";
import { isStripeConfigured } from "@/lib/billing/env";
import { requireTeamLead } from "@/lib/auth/require-team-lead";
import { NotAuthorizedError } from "@/lib/auth/require-super-admin";
import { ensureCustomer } from "@/lib/billing/subscription";
import { getCompany } from "@/lib/billing/state";

/**
 * Create a Stripe Customer Portal session (Decision 3 — C). Used as the
 * fallback surface for payment-method updates, tax/address edits, and failed-
 * payment recovery — plan changes stay in our custom UI. Returns { url }.
 */
export const runtime = "nodejs";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function POST() {
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

  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${APP_URL}/app/billing`,
  });

  return NextResponse.json({ url: session.url });
}
