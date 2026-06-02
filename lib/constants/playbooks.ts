import type { PlanId } from "@/lib/billing/plans";

/**
 * Phase 12.5 — Curated Playbook Library shared constants.
 *
 * Categories are a TEXT field on `playbooks`, not an enum: the super_admin tool
 * offers these six as a pre-populated dropdown but allows custom text for future
 * expansion (Decision 3). The customer browser groups by whatever category
 * values actually exist on published playbooks.
 */
export const PLAYBOOK_CATEGORIES = [
  "Agent Onboarding",
  "Admin Training",
  "Sales Training",
  "AI for Real Estate",
  "Zillow Preferred",
  "Team Leader Playbooks",
] as const;

export type PlaybookCategory = (typeof PLAYBOOK_CATEGORIES)[number];

/**
 * Lucide icon names offered in the icon picker (Decision: ~30 common icons).
 * Stored as a plain string on `playbooks.icon_name`; resolved to a component at
 * render time (see components/playbooks/playbook-icon.tsx).
 */
export const PLAYBOOK_ICONS = [
  "Award",
  "Target",
  "Home",
  "Briefcase",
  "GraduationCap",
  "Rocket",
  "TrendingUp",
  "Users",
  "Star",
  "Trophy",
  "BookOpen",
  "Lightbulb",
  "Sparkles",
  "Compass",
  "Map",
  "Flag",
  "Building2",
  "Handshake",
  "Phone",
  "Megaphone",
  "DollarSign",
  "LineChart",
  "Calendar",
  "Clipboard",
  "FileText",
  "Key",
  "Shield",
  "Zap",
  "Heart",
  "Bot",
] as const;

export type PlaybookIcon = (typeof PLAYBOOK_ICONS)[number];

export const DEFAULT_PLAYBOOK_ICON: PlaybookIcon = "BookOpen";

/** Cover gradient presets (tailwind class fragments, stored verbatim). */
export const PLAYBOOK_GRADIENTS: { label: string; value: string }[] = [
  { label: "Amber → Orange", value: "from-amber-500 to-orange-600" },
  { label: "Blue → Indigo", value: "from-blue-500 to-indigo-600" },
  { label: "Emerald → Teal", value: "from-emerald-500 to-teal-600" },
  { label: "Violet → Purple", value: "from-violet-500 to-purple-600" },
  { label: "Rose → Pink", value: "from-rose-500 to-pink-600" },
  { label: "Sky → Cyan", value: "from-sky-500 to-cyan-600" },
  { label: "Slate → Gray", value: "from-slate-600 to-gray-800" },
  { label: "Fuchsia → Rose", value: "from-fuchsia-500 to-rose-600" },
];

export const DEFAULT_PLAYBOOK_GRADIENT = PLAYBOOK_GRADIENTS[0]!.value;

/**
 * Concurrent install cap by plan (Decision 4). Launch is capped at 2 active
 * installs; Pro and Enterprise are unlimited.
 */
export const LAUNCH_INSTALL_CAP = 2;

/** The install cap for a plan, or `Infinity` for unlimited. */
export function installCapForPlan(plan: PlanId): number {
  return plan === "launch" ? LAUNCH_INSTALL_CAP : Infinity;
}

/** Show the install count on the customer-facing card only when it's credible. */
export const INSTALL_COUNT_CREDIBILITY_THRESHOLD = 10;

export type PlaybookStatus = "draft" | "published" | "archived";
