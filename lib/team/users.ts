import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import type { UserRole } from "@/lib/constants/roles";

type UserRecord = Database["public"]["Tables"]["users"]["Row"];

export type TeamUserStatus = "invited" | "active" | "archived";

/**
 * A unified row for the Users page: either a real `public.users` row or a
 * pending (unaccepted) invitation rendered as an `invited` user. Pending
 * invitations have no auth account yet, so their `id` is the invitation id.
 */
export type TeamUserRow = {
  id: string;
  kind: "user" | "invitation";
  fullName: string | null;
  email: string;
  avatarUrl: string | null;
  role: UserRole;
  status: TeamUserStatus;
  lastActiveAt: string | null;
  invitedAt: string | null;
  /** Present on `invitation` rows — used by "Resend invite". */
  invitationId: string | null;
  /** True when a pending invitation has passed its expiry. */
  expired: boolean;
};

function fromUser(u: UserRecord): TeamUserRow {
  return {
    id: u.id,
    kind: "user",
    fullName: u.full_name,
    email: u.email,
    avatarUrl: u.avatar_url,
    role: u.role,
    status: u.status as TeamUserStatus,
    lastActiveAt: u.last_active_at,
    invitedAt: u.invited_at,
    invitationId: null,
    expired: false,
  };
}

/**
 * Every team member for a company plus any pending invitations. Real users and
 * pending invitations are merged; an email that already has a user row hides its
 * (now-redundant) invitation. RLS scopes both queries to the caller's company.
 */
export async function listTeamUsers(companyId: string): Promise<TeamUserRow[]> {
  const supabase = await createClient();

  const [usersRes, invitesRes] = await Promise.all([
    supabase
      .from("users")
      .select("*")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
    supabase
      .from("user_invitations")
      .select("*")
      .eq("company_id", companyId)
      .is("accepted_at", null)
      .order("created_at", { ascending: false }),
  ]);

  const users = (usersRes.data ?? []).map(fromUser);
  const seenEmails = new Set(users.map((u) => u.email.toLowerCase()));

  const now = Date.now();
  const pending: TeamUserRow[] = [];
  for (const inv of invitesRes.data ?? []) {
    if (seenEmails.has(inv.email.toLowerCase())) continue;
    pending.push({
      id: inv.id,
      kind: "invitation",
      fullName: inv.full_name,
      email: inv.email,
      avatarUrl: null,
      role: inv.role,
      status: "invited",
      lastActiveAt: null,
      invitedAt: inv.created_at,
      invitationId: inv.id,
      expired: new Date(inv.expires_at).getTime() <= now,
    });
  }

  // Pending invitations first (most actionable), then users by name.
  return [
    ...pending,
    ...users.sort((a, b) =>
      (a.fullName ?? a.email).localeCompare(b.fullName ?? b.email),
    ),
  ];
}

/** A single team member's profile row (RLS-scoped), or null. */
export async function getTeamUser(userId: string): Promise<UserRecord | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  return data ?? null;
}
