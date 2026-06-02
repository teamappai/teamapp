import "server-only";
import type { User } from "@supabase/supabase-js";
import { getSessionProfile } from "@/lib/auth/profile";
import type { Profile } from "@/lib/auth/profile";
import { NotAuthorizedError } from "@/lib/auth/require-super-admin";

export type InstallerContext = {
  user: User;
  profile: Profile;
  companyId: string;
  companyName: string | null;
};

/**
 * Data-layer guard for the customer-facing playbook library. Only `team_lead`
 * and `admin_tc` may browse + install playbooks (Phase 12.5). Agents, marketing,
 * and super_admin (who has no company) are refused — middleware redirects them
 * to the dashboard; this is the defense-in-depth re-check before any mutation.
 */
export async function requireInstaller(): Promise<InstallerContext> {
  const session = await getSessionProfile();
  const role = session?.profile.role;
  if (
    !session ||
    !session.profile.company_id ||
    (role !== "team_lead" && role !== "admin_tc")
  ) {
    throw new NotAuthorizedError();
  }
  return {
    user: session.user,
    profile: session.profile,
    companyId: session.profile.company_id,
    companyName: session.companyName,
  };
}
