"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  requireSuperAdmin,
  NotAuthorizedError,
} from "@/lib/auth/require-super-admin";
import { logAudit } from "@/lib/audit/log";
import { getCompany } from "@/lib/billing/state";
import { isStripeConfigured } from "@/lib/billing/env";
import {
  extendTrial as stripeExtendTrial,
  applyCredit as stripeApplyCredit,
} from "@/lib/billing/subscription";
import { reconcileSubscription } from "@/lib/billing/sync";
import {
  IMPERSONATION_ADMIN_ID_COOKIE,
  IMPERSONATION_SESSION_COOKIE,
  IMPERSONATION_MAX_AGE_SECONDS,
  signValue,
  encodeSessionTokens,
} from "@/lib/auth/impersonation";

export type AdminActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

const NOT_AUTHORIZED: AdminActionResult = {
  ok: false,
  error: "Not authorized.",
};

/** Run an admin mutation behind a super_admin guard, normalizing errors. */
async function guarded(
  fn: (ctx: { actorId: string }) => Promise<AdminActionResult>,
): Promise<AdminActionResult> {
  try {
    const { user } = await requireSuperAdmin();
    return await fn({ actorId: user.id });
  } catch (err) {
    if (err instanceof NotAuthorizedError) return NOT_AUTHORIZED;
    console.error("[admin action] unexpected error:", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

// ── company status transitions ────────────────────────────────────────────────
async function setCompanyStatus(
  actorId: string,
  companyId: string,
  status: "paused" | "canceled" | "active",
  action: "company_suspended" | "company_canceled" | "company_restored",
): Promise<AdminActionResult> {
  const service = createServiceClient();
  const { data: company, error } = await service
    .from("companies")
    .update({ status })
    .eq("id", companyId)
    .is("deleted_at", null)
    .select("id, name")
    .maybeSingle();

  if (error) return { ok: false, error: "Could not update the company." };
  if (!company) return { ok: false, error: "Company not found." };

  await logAudit({
    actor_user_id: actorId,
    action,
    resource_type: "company",
    resource_id: companyId,
    metadata: { company_id: companyId, company_name: company.name, status },
  });

  revalidatePath("/app/admin");
  revalidatePath("/app/admin/companies");
  revalidatePath(`/app/admin/companies/${companyId}`);
  return { ok: true, message: `${company.name} updated.` };
}

export async function suspendCompany(
  companyId: string,
): Promise<AdminActionResult> {
  return guarded(({ actorId }) =>
    setCompanyStatus(actorId, companyId, "paused", "company_suspended"),
  );
}

export async function cancelCompany(
  companyId: string,
): Promise<AdminActionResult> {
  return guarded(({ actorId }) =>
    setCompanyStatus(actorId, companyId, "canceled", "company_canceled"),
  );
}

export async function restoreCompany(
  companyId: string,
): Promise<AdminActionResult> {
  return guarded(({ actorId }) =>
    setCompanyStatus(actorId, companyId, "active", "company_restored"),
  );
}

// ── super-admin billing overrides (Decision 11 — C) ───────────────────────────
export async function extendTrialDays(
  companyId: string,
  days = 30,
): Promise<AdminActionResult> {
  return guarded(async ({ actorId }) => {
    const company = await getCompany(companyId);
    if (!company) return { ok: false, error: "Company not found." };

    if (company.stripe_subscription_id && isStripeConfigured()) {
      const sub = await stripeExtendTrial(company.stripe_subscription_id, days);
      await reconcileSubscription(sub);
    } else {
      // No live subscription yet — extend the locally-tracked trial date.
      const base = company.trial_ends_at
        ? new Date(company.trial_ends_at)
        : new Date();
      base.setUTCDate(base.getUTCDate() + days);
      const service = createServiceClient();
      await service
        .from("companies")
        .update({ trial_ends_at: base.toISOString(), status: "trialing" })
        .eq("id", companyId);
    }

    await logAudit({
      actor_user_id: actorId,
      action: "admin_trial_extended",
      resource_type: "company",
      resource_id: companyId,
      metadata: { company_id: companyId, days },
    });
    revalidatePath(`/app/admin/companies/${companyId}`);
    return { ok: true, message: `Trial extended by ${days} days.` };
  });
}

export async function applyCreditToCompany(
  companyId: string,
  amountCents: number,
  reason: string,
): Promise<AdminActionResult> {
  return guarded(async ({ actorId }) => {
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return { ok: false, error: "Enter a positive dollar amount." };
    }
    if (!reason.trim()) return { ok: false, error: "A reason is required." };
    if (!isStripeConfigured()) {
      return { ok: false, error: "Stripe is not configured." };
    }
    const company = await getCompany(companyId);
    if (!company?.stripe_customer_id) {
      return { ok: false, error: "This company has no Stripe customer yet." };
    }

    await stripeApplyCredit({
      customerId: company.stripe_customer_id,
      amountCents: Math.round(amountCents),
      reason: reason.trim(),
    });

    await logAudit({
      actor_user_id: actorId,
      action: "admin_credit_applied",
      resource_type: "company",
      resource_id: companyId,
      metadata: {
        company_id: companyId,
        amount_cents: Math.round(amountCents),
        reason: reason.trim(),
      },
    });
    revalidatePath(`/app/admin/companies/${companyId}`);
    return { ok: true, message: "Credit applied." };
  });
}

export async function forceSuspendCompany(
  companyId: string,
): Promise<AdminActionResult> {
  return guarded(async ({ actorId }) => {
    const service = createServiceClient();
    const { data: company, error } = await service
      .from("companies")
      .update({ status: "suspended" })
      .eq("id", companyId)
      .is("deleted_at", null)
      .select("id, name")
      .maybeSingle();
    if (error) return { ok: false, error: "Could not suspend the company." };
    if (!company) return { ok: false, error: "Company not found." };

    await logAudit({
      actor_user_id: actorId,
      action: "admin_company_suspended",
      resource_type: "company",
      resource_id: companyId,
      metadata: { company_id: companyId, company_name: company.name },
    });
    revalidatePath("/app/admin/companies");
    revalidatePath(`/app/admin/companies/${companyId}`);
    return { ok: true, message: `${company.name} suspended.` };
  });
}

// ── resend invite ───────────────────────────────────────────────────────────
export async function resendInvite(
  companyId: string,
): Promise<AdminActionResult> {
  return guarded(async ({ actorId }) => {
    const service = createServiceClient();
    const { data: pending } = await service
      .from("user_invitations")
      .select("id")
      .eq("company_id", companyId)
      .is("accepted_at", null);

    const count = pending?.length ?? 0;
    if (count === 0) {
      return { ok: true, message: "No pending invitations to resend." };
    }

    // Refresh the expiry window so the resent links stay valid. Actual email
    // delivery is wired with Resend in a later phase.
    const newExpiry = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    ).toISOString();
    await service
      .from("user_invitations")
      .update({ expires_at: newExpiry })
      .eq("company_id", companyId)
      .is("accepted_at", null);

    await logAudit({
      actor_user_id: actorId,
      action: "invite_resent",
      resource_type: "company",
      resource_id: companyId,
      metadata: { company_id: companyId, invitations: count },
    });

    return { ok: true, message: `Refreshed ${count} pending invitation(s).` };
  });
}

// ── feature flags ─────────────────────────────────────────────────────────────
export async function setFlagGlobal(
  key: string,
  enabled: boolean,
): Promise<AdminActionResult> {
  return guarded(async ({ actorId }) => {
    const service = createServiceClient();
    const { error } = await service
      .from("feature_flags")
      .update({ enabled_globally: enabled })
      .eq("key", key);
    if (error) return { ok: false, error: "Could not update the flag." };

    await logAudit({
      actor_user_id: actorId,
      action: "feature_flag_toggled",
      resource_type: "feature_flag",
      metadata: { key, enabled_globally: enabled },
    });

    revalidatePath("/app/admin/flags");
    return { ok: true };
  });
}

export async function setFlagCompanies(
  key: string,
  companyIds: string[],
): Promise<AdminActionResult> {
  return guarded(async ({ actorId }) => {
    const service = createServiceClient();
    const { error } = await service
      .from("feature_flags")
      .update({ enabled_company_ids: companyIds })
      .eq("key", key);
    if (error) return { ok: false, error: "Could not update the flag." };

    await logAudit({
      actor_user_id: actorId,
      action: "feature_flag_companies_updated",
      resource_type: "feature_flag",
      metadata: { key, company_count: companyIds.length },
    });

    revalidatePath("/app/admin/flags");
    return { ok: true };
  });
}

// ── super_admin notes ─────────────────────────────────────────────────────────
export async function createNote(
  companyId: string,
  body: string,
): Promise<AdminActionResult> {
  return guarded(async ({ actorId }) => {
    const trimmed = body.trim();
    if (!trimmed) return { ok: false, error: "Note cannot be empty." };

    const service = createServiceClient();
    const { data: note, error } = await service
      .from("super_admin_notes")
      .insert({ company_id: companyId, body: trimmed, created_by: actorId })
      .select("id")
      .single();
    if (error || !note) return { ok: false, error: "Could not save the note." };

    await logAudit({
      actor_user_id: actorId,
      action: "super_admin_note_created",
      resource_type: "note",
      resource_id: note.id,
      metadata: { company_id: companyId },
    });

    revalidatePath(`/app/admin/companies/${companyId}`);
    return { ok: true };
  });
}

export async function deleteNote(
  noteId: string,
  companyId: string,
): Promise<AdminActionResult> {
  return guarded(async ({ actorId }) => {
    const service = createServiceClient();
    const { error } = await service
      .from("super_admin_notes")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", noteId);
    if (error) return { ok: false, error: "Could not delete the note." };

    await logAudit({
      actor_user_id: actorId,
      action: "super_admin_note_deleted",
      resource_type: "note",
      resource_id: noteId,
      metadata: { company_id: companyId },
    });

    revalidatePath(`/app/admin/companies/${companyId}`);
    return { ok: true };
  });
}

// ── impersonation ─────────────────────────────────────────────────────────────
/**
 * Begin impersonating a user. Captures the admin's identity + original session
 * (to restore later, preserving 2FA assurance), then replaces the active
 * session with the target user's via a service-role-minted magic link. Redirects
 * into the app as the impersonated user. Returns an error result only on failure
 * (the success path redirects and never returns).
 */
export async function startImpersonation(
  userId: string,
): Promise<AdminActionResult | undefined> {
  const result = await guarded(async ({ actorId }) => {
    const service = createServiceClient();

    const { data: target } = await service
      .from("users")
      .select("id, full_name, email, role")
      .eq("id", userId)
      .maybeSingle();
    if (!target) return { ok: false, error: "User not found." };
    if (target.role === "super_admin") {
      return {
        ok: false,
        error: "You cannot impersonate another super admin.",
      };
    }

    const supabase = await createClient();
    const {
      data: { session: adminSession },
    } = await supabase.auth.getSession();
    if (!adminSession) {
      return { ok: false, error: "Your session has expired. Sign in again." };
    }

    // Mint a fresh session for the target via a magic-link token, then verify it
    // on the cookie-bound client so the impersonated user's JWT becomes active.
    const { data: link, error: linkErr } =
      await service.auth.admin.generateLink({
        type: "magiclink",
        email: target.email,
      });
    const tokenHash = link?.properties?.hashed_token;
    if (linkErr || !tokenHash) {
      return { ok: false, error: "Could not start impersonation." };
    }

    await logAudit({
      actor_user_id: actorId,
      action: "impersonate_started",
      resource_type: "user",
      resource_id: target.id,
      metadata: {
        target_email: target.email,
        target_name: target.full_name,
      },
    });

    const cookieStore = await cookies();
    const cookieOpts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: IMPERSONATION_MAX_AGE_SECONDS,
    };
    cookieStore.set(
      IMPERSONATION_ADMIN_ID_COOKIE,
      signValue(actorId),
      cookieOpts,
    );
    cookieStore.set(
      IMPERSONATION_SESSION_COOKIE,
      encodeSessionTokens({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token,
      }),
      cookieOpts,
    );

    const { error: verifyErr } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "magiclink",
    });
    if (verifyErr) {
      cookieStore.delete(IMPERSONATION_ADMIN_ID_COOKIE);
      cookieStore.delete(IMPERSONATION_SESSION_COOKIE);
      return { ok: false, error: "Could not start impersonation." };
    }

    return { ok: true };
  });

  if (result.ok) redirect("/app/dashboard");
  return result;
}
