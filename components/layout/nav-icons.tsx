import {
  Activity,
  Briefcase,
  Building2,
  CreditCard,
  Flag,
  GraduationCap,
  Inbox,
  LayoutDashboard,
  LayoutGrid,
  Library,
  MessageSquare,
  ScrollText,
  Shield,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { NavIconKey } from "@/lib/constants/nav";

/** Maps the serializable nav icon keys to their Lucide components. */
export const NAV_ICONS: Record<NavIconKey, LucideIcon> = {
  adminHome: Shield,
  dashboard: LayoutDashboard,
  companies: Building2,
  users: Users,
  coaching: Target,
  deals: Briefcase,
  requests: Inbox,
  training: GraduationCap,
  messages: MessageSquare,
  managementHub: LayoutGrid,
  playbooks: Library,
  featureFlags: Flag,
  auditLog: ScrollText,
  billing: CreditCard,
  activityLog: Activity,
};
