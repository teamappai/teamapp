"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/profile";
import {
  showsLicenseField,
  licenseRequired,
  type UserRole,
} from "@/lib/constants/roles";
import { changePasswordSchema, profileSchema } from "@/lib/validations/auth";

export type SaveResult =
  | { ok: true; emailChangePending?: boolean }
  | { ok: false; error: string };

/** Persist editable profile fields and, if the email changed, kick off the
 * Supabase email-change verification flow. */
export async function updateProfile(input: {
  fullName: string;
  email: string;
  phone?: string;
  licenseNumber?: string;
}): Promise<SaveResult> {
  const session = await getSessionProfile();
  if (!session) return { ok: false, error: "Your session has expired." };
  const role = session.profile.role as UserRole;

  const parsed = profileSchema(role).safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields." };
  }
  const data = parsed.data as {
    fullName: string;
    email: string;
    phone?: string;
    licenseNumber?: string;
  };

  const supabase = await createClient();

  const update: {
    full_name: string;
    phone: string | null;
    license_number?: string | null;
  } = {
    full_name: data.fullName.trim(),
    phone: data.phone?.trim() ? data.phone.trim() : null,
  };
  if (showsLicenseField(role)) {
    const license = data.licenseNumber?.trim() ?? "";
    if (licenseRequired(role) && !license) {
      return { ok: false, error: "License number is required." };
    }
    update.license_number = license ? license : null;
  }

  const { error: updateErr } = await supabase
    .from("users")
    .update(update)
    .eq("id", session.user.id);
  if (updateErr) {
    return { ok: false, error: "Could not save your profile." };
  }

  // Email change is verification-gated: updateUser sends a confirmation link to
  // the new address. The public.users.email mirror stays on the old address
  // until the change is confirmed (sync handled in a later phase).
  let emailChangePending = false;
  const newEmail = data.email.trim().toLowerCase();
  if (newEmail && newEmail !== session.user.email?.toLowerCase()) {
    const { error: emailErr } = await supabase.auth.updateUser({
      email: newEmail,
    });
    if (emailErr) {
      return { ok: false, error: "Could not start the email change." };
    }
    emailChangePending = true;
  }

  revalidatePath("/app/profile");
  return { ok: true, emailChangePending };
}

/** Verify the current password, then set a new one. */
export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<SaveResult> {
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Check your passwords and try again." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, error: "Your session has expired." };

  // Re-authenticate to confirm the current password before changing it.
  const { error: reauthErr } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.currentPassword,
  });
  if (reauthErr) {
    return { ok: false, error: "Your current password is incorrect." };
  }

  const { error: updateErr } = await supabase.auth.updateUser({
    password: parsed.data.newPassword,
  });
  if (updateErr) {
    return { ok: false, error: "Could not update your password." };
  }
  return { ok: true };
}

/** Persist a newly-uploaded avatar's public URL to the profile row. */
export async function updateAvatar(url: string): Promise<SaveResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session has expired." };

  const { error } = await supabase
    .from("users")
    .update({ avatar_url: url })
    .eq("id", user.id);
  if (error) return { ok: false, error: "Could not save your avatar." };

  revalidatePath("/app/profile");
  return { ok: true };
}
