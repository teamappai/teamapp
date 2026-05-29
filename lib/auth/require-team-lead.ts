import "server-only";
import type { User } from "@supabase/supabase-js";
import { getSessionProfile } from "@/lib/auth/profile";
import type { Profile } from "@/lib/auth/profile";
import { NotAuthorizedError } from "@/lib/auth/require-super-admin";

export type TeamLeadContext = {
  user: User;
  profile: Profile;
  /** The company the team_lead manages. NULL only for super_admin. */
  companyId: string | null;
  /** The managed company's display name (NULL for super_admin). */
  companyName: string | null;
};

/**
 * Data-layer guard for team-lead surfaces (the Users page and Management Hub).
 * Call at the top of every team-lead Server Component, page, and Server Action.
 * Allows `team_lead` and `super_admin` (platform staff can manage any company);
 * everyone else throws {@link NotAuthorizedError}.
 *
 * Defense-in-depth: middleware already returns a 403 page for `/app/users` and
 * `/app/management` from disallowed roles. While a super_admin is impersonating
 * another user, the active session is that user's — so this correctly reflects
 * the impersonated role.
 */
export async function requireTeamLead(): Promise<TeamLeadContext> {
  const session = await getSessionProfile();
  const role = session?.profile.role;
  if (!session || (role !== "team_lead" && role !== "super_admin")) {
    throw new NotAuthorizedError();
  }
  return {
    user: session.user,
    profile: session.profile,
    companyId: session.profile.company_id,
    companyName: session.companyName,
  };
}
