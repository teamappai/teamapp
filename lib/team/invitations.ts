import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import type { UserRole } from "@/lib/constants/roles";

export type Invitation =
  Database["public"]["Tables"]["user_invitations"]["Row"];

export const INVITE_TTL_DAYS = 14;

/** A cryptographically-random, URL-safe invitation token. */
export function generateInviteToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function inviteExpiresAt(): string {
  return new Date(
    Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
}

/**
 * Emails that cannot be (re-)invited into a company: any that already have a
 * non-deleted user row, or an outstanding (unaccepted, unexpired) invitation.
 * Returned lowercased for case-insensitive comparison. RLS scopes both reads.
 */
export async function findConflictingEmails(
  companyId: string,
  emails: string[],
): Promise<Set<string>> {
  const normalized = [...new Set(emails.map((e) => e.trim().toLowerCase()))];
  if (normalized.length === 0) return new Set();

  const supabase = await createClient();
  const [usersRes, invitesRes] = await Promise.all([
    supabase
      .from("users")
      .select("email")
      .eq("company_id", companyId)
      .is("deleted_at", null),
    supabase
      .from("user_invitations")
      .select("email, expires_at")
      .eq("company_id", companyId)
      .is("accepted_at", null),
  ]);

  const conflicts = new Set<string>();
  const wanted = new Set(normalized);
  for (const u of usersRes.data ?? []) {
    const e = u.email.toLowerCase();
    if (wanted.has(e)) conflicts.add(e);
  }
  const now = Date.now();
  for (const inv of invitesRes.data ?? []) {
    const e = inv.email.toLowerCase();
    if (wanted.has(e) && new Date(inv.expires_at).getTime() > now) {
      conflicts.add(e);
    }
  }
  return conflicts;
}

export type CreateInvitationInput = {
  companyId: string;
  email: string;
  fullName: string | null;
  role: UserRole;
  invitedBy: string;
  welcomeMessage?: string | null;
  assignedModuleIds?: string[];
};

/** Insert a single invitation row (RLS requires the caller to manage the company). */
export async function createInvitation(
  input: CreateInvitationInput,
): Promise<
  { ok: true; invitation: Invitation } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const token = generateInviteToken();
  const { data, error } = await supabase
    .from("user_invitations")
    .insert({
      company_id: input.companyId,
      email: input.email.trim().toLowerCase(),
      full_name: input.fullName?.trim() || null,
      role: input.role,
      invited_by: input.invitedBy,
      token,
      expires_at: inviteExpiresAt(),
      welcome_message: input.welcomeMessage?.trim() || null,
      assigned_module_ids: input.assignedModuleIds ?? [],
    })
    .select("*")
    .single();

  if (error || !data) {
    return {
      ok: false,
      error: error?.message ?? "Could not create invitation.",
    };
  }
  return { ok: true, invitation: data };
}

/** Refresh an existing invitation's token + expiry (for "Resend invite"). */
export async function refreshInvitation(
  invitationId: string,
): Promise<
  { ok: true; invitation: Invitation } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_invitations")
    .update({ token: generateInviteToken(), expires_at: inviteExpiresAt() })
    .eq("id", invitationId)
    .is("accepted_at", null)
    .select("*")
    .single();

  if (error || !data) {
    return {
      ok: false,
      error: error?.message ?? "Could not resend invitation.",
    };
  }
  return { ok: true, invitation: data };
}
