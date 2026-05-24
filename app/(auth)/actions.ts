"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getInvitationByToken } from "@/lib/auth/invitations";
import { sanitizeNext } from "@/lib/auth/redirects";
import { roleHomePath } from "@/lib/constants/roles";
import {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  signupSchema,
} from "@/lib/validations/auth";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export type ActionResult =
  | { ok: true; redirectTo: string }
  | { ok: true; mfaRequired: true; redirectTo: string }
  | { ok: false; error: string };

export async function signIn(formData: {
  email: string;
  password: string;
  next?: string | null;
}): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(formData);
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid email and password." };
  }

  const supabase = await createClient();
  const { data: signInData, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error || !signInData.user) {
    return { ok: false, error: "Incorrect email or password." };
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", signInData.user.id)
    .single();
  const redirectTo =
    sanitizeNext(formData.next) ??
    (profile ? roleHomePath(profile.role) : "/app/dashboard");

  // If the account has a verified TOTP factor, the password sign-in only
  // reaches aal1 — the client must complete a TOTP challenge to reach aal2.
  const { data: aal } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== aal.nextLevel) {
    return { ok: true, mfaRequired: true, redirectTo };
  }

  return { ok: true, redirectTo };
}

export async function requestPasswordReset(formData: {
  email: string;
}): Promise<{ ok: boolean }> {
  const parsed = forgotPasswordSchema.safeParse(formData);
  // Always report success so the form never reveals whether an email exists.
  if (!parsed.success) return { ok: true };

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${APP_URL}/auth/confirm?next=/reset-password`,
  });
  return { ok: true };
}

export async function updatePassword(formData: {
  password: string;
  confirmPassword: string;
}): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(formData);
  if (!parsed.success) {
    return { ok: false, error: "Passwords must match and be 8+ characters." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      error: "Your reset link has expired. Request a new one.",
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    return { ok: false, error: "Could not update your password." };
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  return {
    ok: true,
    redirectTo: profile ? roleHomePath(profile.role) : "/app/dashboard",
  };
}

export async function acceptInvitation(formData: {
  token: string;
  fullName: string;
  password: string;
  confirmPassword: string;
}): Promise<ActionResult> {
  const parsed = signupSchema.safeParse({
    fullName: formData.fullName,
    password: formData.password,
    confirmPassword: formData.confirmPassword,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Enter your name and a matching password of 8+ characters.",
    };
  }

  const lookup = await getInvitationByToken(formData.token);
  if (!lookup.ok) {
    return {
      ok: false,
      error:
        lookup.reason === "expired"
          ? "This invitation has expired. Ask your team lead to resend it."
          : "This invitation is no longer valid.",
    };
  }
  const invitation = lookup.invitation;

  // Service-role: creates the auth user and its mirrored profile row in one
  // server-trusted step (there is no signup trigger; RLS would block a brand-
  // new user from inserting their own profile).
  const service = createServiceClient();
  const { data: created, error: createErr } =
    await service.auth.admin.createUser({
      email: invitation.email,
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: {
        full_name: parsed.data.fullName,
        role: invitation.role,
      },
    });
  if (createErr || !created.user) {
    return {
      ok: false,
      error: "An account already exists for this email. Try logging in.",
    };
  }

  const { error: profileErr } = await service.from("users").insert({
    id: created.user.id,
    company_id: invitation.company_id,
    email: invitation.email,
    full_name: parsed.data.fullName,
    role: invitation.role,
    status: "active",
    invited_at: invitation.created_at,
  });
  if (profileErr) {
    // Roll back the orphaned auth user so the invite can be retried cleanly.
    await service.auth.admin.deleteUser(created.user.id);
    return { ok: false, error: "Could not finish setting up your account." };
  }

  await service
    .from("user_invitations")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invitation.id);

  const supabase = await createClient();
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: invitation.email,
    password: parsed.data.password,
  });
  if (signInErr) {
    // Account exists now; send them to log in manually.
    return { ok: true, redirectTo: "/login" };
  }

  return { ok: true, redirectTo: roleHomePath(invitation.role) };
}
