import type { UserRole } from "@/lib/constants/roles";

/**
 * Role gating for the Requests feature (audit PA-4, F-132, F-133, F-136). Single
 * source of truth, mirrored in middleware, server data helpers, and the UI so
 * the three never drift.
 *
 * Conceptual model: requests are bidirectional task assignments between any team
 * members (agent → marketing, team_lead → agent, admin ↔ agent, …), not just
 * agent → support. `request_type.default_assignee_role` is a HINT, not a rule.
 */

/** Everyone in a company can see the Requests list (it's the team's work queue). */
export function canViewRequests(role: UserRole): boolean {
  return (
    role === "agent" ||
    role === "team_lead" ||
    role === "admin_tc" ||
    role === "marketing" ||
    role === "super_admin"
  );
}

/** Marketing is fulfill-only — it cannot create requests (F-136). */
export function canCreateRequests(role: UserRole): boolean {
  return (
    role === "agent" ||
    role === "team_lead" ||
    role === "admin_tc" ||
    role === "super_admin"
  );
}

/** team_lead / super_admin can manage (delete, claim/reassign) any request. */
export function canManageRequests(role: UserRole): boolean {
  return role === "team_lead" || role === "super_admin";
}

/**
 * Who may soft-delete a specific request: a manager, or the person who created
 * it (NOTES: "creator + team_lead + super_admin only").
 */
export function canDeleteRequest(role: UserRole, isCreator: boolean): boolean {
  return canManageRequests(role) || isCreator;
}

export type RequestTab = "my-queue" | "team-queue" | "my-requests";

export const REQUEST_TABS: RequestTab[] = [
  "my-queue",
  "team-queue",
  "my-requests",
];

/** Default tab a role lands on (TAB SEMANTICS / DEFAULT TAB BY ROLE). */
export function defaultTabForRole(role: UserRole): RequestTab {
  switch (role) {
    case "agent":
      return "my-requests";
    case "admin_tc":
    case "marketing":
      return "my-queue";
    case "team_lead":
    case "super_admin":
    default:
      return "team-queue";
  }
}

/** "My requests" is hidden for marketing (they can't create). */
export function tabsForRole(role: UserRole): RequestTab[] {
  if (role === "marketing") return ["my-queue", "team-queue"];
  return REQUEST_TABS;
}

export const TAB_LABELS: Record<RequestTab, string> = {
  "my-queue": "My queue",
  "team-queue": "Team queue",
  "my-requests": "My requests",
};

/**
 * Resolve the requested tab from a search param, falling back to the role
 * default and never returning a tab the role can't access.
 */
export function resolveTab(role: UserRole, value?: string): RequestTab {
  const allowed = tabsForRole(role);
  if (value && (allowed as string[]).includes(value))
    return value as RequestTab;
  const fallback = defaultTabForRole(role);
  return allowed.includes(fallback) ? fallback : allowed[0]!;
}
