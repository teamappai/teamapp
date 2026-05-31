import type { UserRole } from "@/lib/constants/roles";

/**
 * Role gating for Coaching + Activity Log (audit PA-5/PA-6). Single source of
 * truth, enforced in middleware, in the server pages, and mirrored in the UI.
 */

/**
 * Who can open /app/coaching. Everyone on a team except marketing (F-031-style
 * scoping: marketing is fulfill-only and has no funnel). super_admin views any
 * company; agents see a self-scoped variant.
 */
export function canViewCoaching(role: UserRole): boolean {
  return (
    role === "agent" ||
    role === "team_lead" ||
    role === "admin_tc" ||
    role === "super_admin"
  );
}

/**
 * Coach/manager privileges on the coaching surface: full leaderboard regardless
 * of the company toggle, add/delete coaching notes, set goals for any agent,
 * send nudges. admin_tc has the SAME access as team_lead here (Phase 10
 * decision), alongside team_lead and super_admin.
 */
export function isCoachRole(role: UserRole): boolean {
  return role === "team_lead" || role === "super_admin" || role === "admin_tc";
}

/** Only managers may delete a coaching log entry (audit: team_lead-only delete). */
export function canDeleteCoachingNote(role: UserRole): boolean {
  return isCoachRole(role);
}

/**
 * Who logs daily activity at /app/activity-log. Agents are the primary users;
 * team_leads also produce. admin_tc/marketing have no prospecting funnel.
 */
export function canLogActivity(role: UserRole): boolean {
  return role === "agent" || role === "team_lead";
}
