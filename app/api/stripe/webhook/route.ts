import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/billing/stripe";
import { stripeEnv } from "@/lib/billing/env";
import { createServiceClient } from "@/lib/supabase/service";
import {
  reconcileSubscription,
  companyIdForCustomer,
} from "@/lib/billing/sync";
import { getPlan, type PlanId } from "@/lib/billing/plans";
import {
  emailSubscriptionCreated,
  emailPaymentFailed,
  emailPaymentRecovered,
  emailSubscriptionPaused,
  emailCancellationCompleted,
  emailTrialEnding,
} from "@/lib/email/billing";
import { captureServer } from "@/lib/posthog/server";

/**
 * Stripe webhook handler (Phase 12). Verifies the signature, enforces
 * at-most-once processing via subscription_events.stripe_event_id (UNIQUE),
 * then mirrors subscription state onto companies and fires the matching emails.
 *
 * Must read the RAW request body for signature verification — never JSON-parse
 * before constructEvent.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function teamLeadEmail(companyId: string): Promise<string | null> {
  const service = createServiceClient();
  const { data } = await service
    .from("users")
    .select("email")
    .eq("company_id", companyId)
    .eq("role", "team_lead")
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.email ?? null;
}

async function companyName(companyId: string): Promise<string> {
  const service = createServiceClient();
  const { data } = await service
    .from("companies")
    .select("name")
    .eq("id", companyId)
    .maybeSingle();
  return data?.name ?? "Your team";
}

export async function POST(req: NextRequest) {
  let env;
  try {
    env = stripeEnv();
  } catch (err) {
    console.error("[stripe webhook] not configured:", err);
    return NextResponse.json(
      { error: "Stripe not configured" },
      { status: 500 },
    );
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await req.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    console.error("[stripe webhook] signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // ── Idempotency: claim the event id before doing any work. ──────────────────
  const service = createServiceClient();
  const { error: claimError } = await service
    .from("subscription_events")
    .insert({
      stripe_event_id: event.id,
      event_type: event.type,
      payload: JSON.parse(rawBody),
      processed_at: new Date().toISOString(),
    });
  if (claimError) {
    // 23505 = unique_violation → already processed this delivery.
    if (claimError.code === "23505") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error("[stripe webhook] failed to record event:", claimError);
    // Fall through and still try to process — better than dropping the event.
  }

  try {
    await handleEvent(event);
  } catch (err) {
    console.error(`[stripe webhook] error handling ${event.type}:`, err);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleEvent(event: Stripe.Event): Promise<void> {
  const service = createServiceClient();

  switch (event.type) {
    case "customer.subscription.created": {
      const sub = event.data.object as Stripe.Subscription;
      const companyId = await reconcileSubscription(sub);
      if (companyId) {
        const email = await teamLeadEmail(companyId);
        const name = await companyName(companyId);
        const planId = (sub.metadata?.plan as PlanId) ?? "launch";
        if (email) {
          await emailSubscriptionCreated({
            to: email,
            companyName: name,
            planName: getPlan(planId).display_name,
          });
        }
      }
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      await reconcileSubscription(sub);
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const companyId = await reconcileSubscription(sub);
      if (companyId) {
        await service
          .from("companies")
          .update({ status: "canceled" })
          .eq("id", companyId);
        const email = await teamLeadEmail(companyId);
        if (email) await emailCancellationCompleted({ to: email });
        // PostHog: unsubscribe_completed (CR-3 billing intent funnel terminus).
        // No user in a webhook — attribute to the company group/distinctId.
        await captureServer(
          "unsubscribe_completed",
          { company_id: companyId },
          companyId,
          { company: companyId },
        );
      }
      break;
    }

    case "customer.subscription.paused": {
      const sub = event.data.object as Stripe.Subscription;
      const companyId = await reconcileSubscription(sub);
      if (companyId) {
        const email = await teamLeadEmail(companyId);
        if (email) {
          await emailSubscriptionPaused({
            to: email,
            resumeDate: sub.pause_collection?.resumes_at
              ? new Date(sub.pause_collection.resumes_at * 1000)
              : null,
          });
        }
      }
      break;
    }

    case "customer.subscription.resumed": {
      const sub = event.data.object as Stripe.Subscription;
      await reconcileSubscription(sub);
      break;
    }

    case "customer.subscription.trial_will_end": {
      const sub = event.data.object as Stripe.Subscription;
      const companyId = await reconcileSubscription(sub);
      if (companyId && sub.trial_end) {
        const email = await teamLeadEmail(companyId);
        if (email) {
          await emailTrialEnding({
            to: email,
            daysLeft: 3,
            chargeDate: new Date(sub.trial_end * 1000),
          });
        }
      }
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId =
        typeof invoice.customer === "string"
          ? invoice.customer
          : (invoice.customer?.id ?? null);
      const companyId = await companyIdForCustomer(customerId);
      if (companyId) {
        // Recovery: if we were past_due, flip back to active + notify.
        const { data: company } = await service
          .from("companies")
          .select("status")
          .eq("id", companyId)
          .maybeSingle();
        const wasPastDue = company?.status === "past_due";
        await service
          .from("companies")
          .update({ status: "active" })
          .eq("id", companyId)
          .in("status", ["past_due", "trialing"]);
        if (wasPastDue) {
          const email = await teamLeadEmail(companyId);
          if (email) await emailPaymentRecovered({ to: email });
        }
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId =
        typeof invoice.customer === "string"
          ? invoice.customer
          : (invoice.customer?.id ?? null);
      const companyId = await companyIdForCustomer(customerId);
      if (companyId) {
        await service
          .from("companies")
          .update({ status: "past_due" })
          .eq("id", companyId);
        const email = await teamLeadEmail(companyId);
        if (email) {
          await emailPaymentFailed({
            to: email,
            retryByDate: invoice.next_payment_attempt
              ? new Date(invoice.next_payment_attempt * 1000)
              : null,
          });
        }
        // Notify super_admin via audit log (no actor — system event).
        await service.from("audit_log").insert({
          actor_user_id: null,
          action: "payment_failed",
          resource_type: "company",
          resource_id: companyId,
          payload: { invoice_id: invoice.id ?? null },
        });
      }
      break;
    }

    default:
      // Unhandled event types are acknowledged (recorded for idempotency).
      break;
  }
}
