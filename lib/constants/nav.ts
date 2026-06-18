import type { UserRole } from "@/lib/constants/roles";

/**
 * Sidebar navigation — the single source of truth for which items each role
 * sees (audit CR-7). Filtering happens here, server-side, off the verified
 * session role; the client never decides its own menu, and the data layer (RLS)
 * independently rejects any out-of-scope request.
 *
 * Icons are referenced by string key (see `components/layout/nav-icons.tsx`) so
 * the computed item list stays serializable across the server→client boundary.
 */

export type NavIconKey =
  | "adminHome"
  | "dashboard"
  | "companies"
  | "users"
  | "coaching"
  | "deals"
  | "deal"
  | "requests"
  | "training"
  | "messages"
  | "managementHub"
  | "playbooks"
  | "featureFlags"
  | "auditLog"
  | "billing"
  | "activityLog"
  | "invite"
  | "plus";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIconKey;
  /** Match the pathname exactly (used for "home" items that prefix others). */
  exact?: boolean;
};

export type SidebarCta = {
  href: string;
  label: string;
  /** "plus" prepends a leading + icon. */
  icon?: "plus" | "deal" | "invite";
};

const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  // Phase 5 ships the super-admin console below. Other admin areas (coaching,
  // deals, management, billing) arrive in later phases and are added here then,
  // so the sidebar never links to a route that doesn't exist yet.
  super_admin: [
    { href: "/app/admin", label: "Admin Home", icon: "adminHome", exact: true },
    { href: "/app/admin/companies", label: "Companies", icon: "companies" },
    { href: "/app/admin/users", label: "Users", icon: "users" },
    // super_admin can view all deals across companies (F-025 "All Deals"); they
    // cannot create deals (F-031), so no CTA is wired below for this role.
    { href: "/app/deals", label: "Deals", icon: "deals" },
    { href: "/app/requests", label: "Requests", icon: "requests" },
    {
      href: "/app/admin/playbooks",
      label: "Playbook Library",
      icon: "playbooks",
    },
    { href: "/app/admin/flags", label: "Feature Flags", icon: "featureFlags" },
    { href: "/app/admin/audit", label: "Audit Log", icon: "auditLog" },
  ],
  team_lead: [
    {
      href: "/app/dashboard",
      label: "Dashboard",
      icon: "dashboard",
      exact: true,
    },
    { href: "/app/coaching", label: "Coaching", icon: "coaching" },
    { href: "/app/deals", label: "Deals", icon: "deals" },
    { href: "/app/requests", label: "Requests", icon: "requests" },
    { href: "/app/training", label: "Training", icon: "training" },
    { href: "/app/playbooks", label: "Playbooks", icon: "playbooks" },
    { href: "/app/messages", label: "Messages", icon: "messages" },
    { href: "/app/users", label: "Users", icon: "users" },
    { href: "/app/management", label: "Management Hub", icon: "managementHub" },
    { href: "/app/billing", label: "Billing", icon: "billing" },
  ],
  agent: [
    {
      href: "/app/dashboard",
      label: "Dashboard",
      icon: "dashboard",
      exact: true,
    },
    { href: "/app/coaching", label: "Coaching", icon: "coaching" },
    { href: "/app/deals", label: "Deals", icon: "deals" },
    { href: "/app/requests", label: "Requests", icon: "requests" },
    { href: "/app/training", label: "Training", icon: "training" },
    { href: "/app/messages", label: "Messages", icon: "messages" },
    { href: "/app/activity-log", label: "Activity Log", icon: "activityLog" },
  ],
  admin_tc: [
    {
      href: "/app/dashboard",
      label: "Dashboard",
      icon: "dashboard",
      exact: true,
    },
    { href: "/app/coaching", label: "Coaching", icon: "coaching" },
    { href: "/app/requests", label: "Requests", icon: "requests" },
    { href: "/app/deals", label: "Deals", icon: "deals" },
    { href: "/app/training", label: "Training", icon: "training" },
    { href: "/app/playbooks", label: "Playbooks", icon: "playbooks" },
    { href: "/app/messages", label: "Messages", icon: "messages" },
  ],
  marketing: [
    {
      href: "/app/dashboard",
      label: "Dashboard",
      icon: "dashboard",
      exact: true,
    },
    { href: "/app/requests", label: "Requests", icon: "requests" },
    { href: "/app/training", label: "Training", icon: "training" },
    { href: "/app/messages", label: "Messages", icon: "messages" },
  ],
};

const CTA_BY_ROLE: Partial<Record<UserRole, SidebarCta>> = {
  agent: { href: "/app/deals/new", label: "New Deal", icon: "deal" },
  team_lead: {
    href: "/app/users?invite=1",
    label: "Invite users",
    icon: "invite",
  },
  admin_tc: { href: "/app/requests/new", label: "New Request", icon: "plus" },
  // Marketing is fulfill-only and cannot create requests (F-136) — no CTA.
};

/** The nav items a given role is allowed to see. */
export function navForRole(role: UserRole): NavItem[] {
  return NAV_BY_ROLE[role];
}

/** The sidebar primary CTA for a role, or null when the role has none. */
export function ctaForRole(role: UserRole): SidebarCta | null {
  return CTA_BY_ROLE[role] ?? null;
}
