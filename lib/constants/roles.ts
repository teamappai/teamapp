import type { Database } from "@/types/supabase";

export type UserRole = Database["public"]["Enums"]["user_role"];

/** The canonical five roles, in display order. */
export const ROLES: readonly UserRole[] = [
  "super_admin",
  "team_lead",
  "agent",
  "admin_tc",
  "marketing",
] as const;

/** Human-readable label for a role chip. */
export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Super Admin",
  team_lead: "Team Lead",
  agent: "Agent",
  admin_tc: "Admin / TC",
  marketing: "Marketing",
};

/**
 * Where a freshly-authenticated user of each role should land. super_admin is
 * platform staff and goes to the admin console; everyone else lands on the team
 * dashboard. (The sidebar nav that differentiates these views is Phase 3.)
 */
export function roleHomePath(role: UserRole): string {
  return role === "super_admin" ? "/app/admin" : "/app/dashboard";
}

/** super_admin MUST have 2FA (audit F-008); enforced in middleware. */
export function roleRequiresMfa(role: UserRole): boolean {
  return role === "super_admin";
}

/** Whether the profile form shows the real-estate license field (audit F-009). */
export function showsLicenseField(role: UserRole): boolean {
  return role === "agent" || role === "team_lead";
}

/** Agents must record a license; team_leads may leave it blank. */
export function licenseRequired(role: UserRole): boolean {
  return role === "agent";
}

/** Whether to show brokerage (company) context on the profile (audit F-009). */
export function showsBrokerageInfo(role: UserRole): boolean {
  return role === "agent" || role === "team_lead";
}
