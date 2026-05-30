import type { UserRole } from "@/lib/constants/roles";

/**
 * Role gating for the Deals feature (audit F-031, F-133, SR-5). These are the
 * single source of truth, enforced in middleware, in server data helpers, and
 * mirrored in the UI so the three never drift.
 */

/** Who can see deal data at all. Marketing does NOT (F-031 / F-133). */
export function canViewDeals(role: UserRole): boolean {
  return (
    role === "agent" ||
    role === "team_lead" ||
    role === "admin_tc" ||
    role === "super_admin"
  );
}

/**
 * Who can create deals. super_admin is excluded (F-031): a super_admin adding a
 * deal creates ambiguous ownership; they add on-behalf-of via the company admin
 * surface instead.
 */
export function canCreateDeals(role: UserRole): boolean {
  return role === "agent" || role === "team_lead" || role === "admin_tc";
}

/** Who can soft-delete a deal: team_lead and super_admin only (SR-5). */
export function canDeleteDeals(role: UserRole): boolean {
  return role === "team_lead" || role === "super_admin";
}
