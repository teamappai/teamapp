"use server";

import { revalidatePath } from "next/cache";
import { requireTeamLead } from "@/lib/auth/require-team-lead";
import { NotAuthorizedError } from "@/lib/auth/require-super-admin";
import { logAudit } from "@/lib/audit/log";
import { createServiceClient } from "@/lib/supabase/service";
import { getCompany } from "@/lib/billing/state";
import { cancelAtPeriodEnd } from "@/lib/billing/subscription";
import { reconcileSubscription } from "@/lib/billing/sync";
import { isStripeConfigured } from "@/lib/billing/env";
import { emailCancellationScheduled } from "@/lib/email/billing";

export type CancelResult =
  | { ok: true; accessUntil: string }
  | { ok: false; error: string };

/** Allowed cancellation reason categories (Decision 7). Kept in sync with the UI. */
const CANCEL_REASONS = [
  "price",
  "switching",
  "not_using",
  "missing_features",
  "support",
  "bugs",
  "shutdown",
  "temporary",
  "other",
] as const;
export type CancelReason = (typeof CANCEL_REASONS)[number];

export async function scheduleCancellation(input: {
  reasonCategory: string;
  reasonText?: string | null;
  optionalFeedback?: string | null;
  confirmText: string;
}): Promise<CancelResult> {
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
  if (input.confirmText.trim() !== "CANCEL") {
    return { ok: false, error: 'Type "CANCEL" to confirm.' };
  }
  if (!(CANCEL_REASONS as readonly string[]).includes(input.reasonCategory)) {
    return { ok: false, error: "Choose a reason for cancelling." };
  }
  if (!isStripeConfigured()) {
    return { ok: false, error: "Billing is not configured." };
  }

  const company = await getCompany(ctx.companyId);
  if (!company) return { ok: false, error: "Company not found." };

  try {
    const service = createServiceClient();
    let accessUntil = company.current_period_end;

    if (company.stripe_subscription_id) {
      const sub = await cancelAtPeriodEnd(company.stripe_subscription_id);
      await reconcileSubscription(sub);
      const periodEnd = sub.items.data[0]?.current_period_end;
      if (periodEnd) accessUntil = new Date(periodEnd * 1000).toISOString();
    }
    if (!accessUntil) {
      // No subscription/period info — default to the trial end or now.
      accessUntil = company.trial_ends_at ?? new Date().toISOString();
    }

    await service
      .from("companies")
      .update({
        status: "cancellation_scheduled",
        cancellation_scheduled_for: accessUntil,
      })
      .eq("id", ctx.companyId);

    await service.from("cancellations").insert({
      company_id: ctx.companyId,
      user_id: ctx.profile.id,
      reason_category: input.reasonCategory,
      reason_text: input.reasonText?.trim() || null,
      optional_feedback: input.optionalFeedback?.trim() || null,
      scheduled_for: accessUntil.slice(0, 10),
    });

    await logAudit({
      actor_user_id: ctx.profile.id,
      action: "cancellation_scheduled",
      resource_type: "subscription",
      resource_id: ctx.companyId,
      metadata: {
        reason_category: input.reasonCategory,
        scheduled_for: accessUntil,
      },
    });

    await emailCancellationScheduled({
      to: ctx.profile.email,
      accessUntil,
    });

    revalidatePath("/app/billing");
    return { ok: true, accessUntil };
  } catch (err) {
    console.error("[cancel action] error:", err);
    return { ok: false, error: "Could not schedule cancellation. Try again." };
  }
}
