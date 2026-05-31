import { formatCurrency, formatNumber } from "@/lib/utils/format";
import {
  GROUP_METRIC_KEYS,
  type ActivityMetricKey,
} from "@/lib/constants/activity-metrics";
import type { Database } from "@/types/supabase";

/**
 * Goal catalog + progress math (PA-6, hybrid ownership). Goal types are
 * categorized as OUTCOME (commonly agent-set: GCI, volume, deals) or
 * INPUT/STANDARD (commonly team_lead-set: activity counts), but either party
 * may create or edit either kind in scope — the category only drives UI
 * defaults and grouping.
 */

export type GoalType = Database["public"]["Enums"]["goal_type"];
export type GoalPeriod = Database["public"]["Enums"]["goal_period"];
export type GoalCategory = "outcome" | "input";
export type GoalFormat = "currency" | "count";

export type GoalTypeDef = {
  type: GoalType;
  label: string;
  category: GoalCategory;
  format: GoalFormat;
  helper: string;
};

export const GOAL_TYPES: readonly GoalTypeDef[] = [
  // ── Outcome goals (commonly agent-set) ──────────────────────────────────
  {
    type: "gci_cents",
    label: "GCI",
    category: "outcome",
    format: "currency",
    helper: "Gross commission income from deals that closed in the period.",
  },
  {
    type: "closed_volume_cents",
    label: "Closed Volume",
    category: "outcome",
    format: "currency",
    helper: "Total sales price of deals that closed in the period.",
  },
  {
    type: "closed_deals_count",
    label: "Closed Deals",
    category: "outcome",
    format: "count",
    helper: "Number of deals that closed in the period.",
  },
  // ── Input / standard goals (commonly team_lead-set) ─────────────────────
  {
    type: "conversations_count",
    label: "Conversations",
    category: "input",
    format: "count",
    helper: "Logged conversations across the period.",
  },
  {
    type: "appointments_count",
    label: "Appointments",
    category: "input",
    format: "count",
    helper: "All five appointment types, summed across the period.",
  },
  {
    type: "top_of_funnel_count",
    label: "Top of Funnel",
    category: "input",
    format: "count",
    helper: "All six top-of-funnel volume metrics, summed across the period.",
  },
  {
    type: "listings_signed_count",
    label: "Listings Signed",
    category: "input",
    format: "count",
    helper: "Listing agreements signed across the period.",
  },
  {
    type: "buyer_agreements_signed_count",
    label: "Buyer Agreements Signed",
    category: "input",
    format: "count",
    helper: "Buyer representation agreements signed across the period.",
  },
  {
    type: "pqs_count",
    label: "PQ's",
    category: "input",
    format: "count",
    helper: "Pre-qualification letters obtained across the period.",
  },
  {
    type: "showings_count",
    label: "Showings",
    category: "input",
    format: "count",
    helper: "Property showings attended across the period.",
  },
  {
    type: "offers_submitted_count",
    label: "Offers Submitted",
    category: "input",
    format: "count",
    helper: "Written offers submitted across the period.",
  },
] as const;

export function goalDef(type: GoalType): GoalTypeDef {
  return GOAL_TYPES.find((g) => g.type === type) ?? GOAL_TYPES[0];
}

export const GOAL_PERIOD_LABELS: Record<GoalPeriod, string> = {
  monthly: "This month",
  quarterly: "This quarter",
  annual: "This year",
};

/** Format a goal target/actual value for display (coaching: precise compact). */
export function formatGoalValue(type: GoalType, value: number): string {
  return goalDef(type).format === "currency"
    ? formatCurrency(value, { compact: value >= 1_000_000, precise: true })
    : formatNumber(value);
}

// ── period window math ────────────────────────────────────────────────────────

/** Inclusive [start, end] YYYY-MM-DD window for a goal's period. */
export function goalWindow(
  period: GoalPeriod,
  periodStart: string,
): { start: string; end: string } {
  const [y, m, d] = periodStart.split("-").map(Number);
  const start = new Date(y, m - 1, d);
  const end = new Date(start);
  if (period === "monthly") end.setMonth(end.getMonth() + 1);
  else if (period === "quarterly") end.setMonth(end.getMonth() + 3);
  else end.setFullYear(end.getFullYear() + 1);
  end.setDate(end.getDate() - 1); // inclusive last day
  const iso = (dt: Date) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(
      dt.getDate(),
    ).padStart(2, "0")}`;
  return { start: iso(start), end: iso(end) };
}

// ── actual computation ────────────────────────────────────────────────────────

export type GoalActivityRow = Partial<Record<ActivityMetricKey, number>> & {
  log_date: string;
};
export type GoalDealRow = {
  gci_cents: number | null;
  sales_price_cents: number | null;
  close_date: string | null;
  isTerminalWon: boolean;
};

/** Which single activity column (if any) a count goal maps directly onto. */
const DIRECT_METRIC: Partial<Record<GoalType, ActivityMetricKey>> = {
  conversations_count: "conversations",
  listings_signed_count: "listings_signed",
  buyer_agreements_signed_count: "buyer_agreements_signed",
  pqs_count: "pqs",
  showings_count: "showings",
  offers_submitted_count: "offers_submitted",
};

const within = (iso: string | null, start: string, end: string) =>
  !!iso && iso.slice(0, 10) >= start && iso.slice(0, 10) <= end;

/**
 * Compute the actual achieved value for a goal over its own period window,
 * from the agent's activity rows and deals.
 */
export function computeGoalActual(
  type: GoalType,
  window: { start: string; end: string },
  data: { activity: GoalActivityRow[]; deals: GoalDealRow[] },
): number {
  const { start, end } = window;
  const activity = data.activity.filter((r) => within(r.log_date, start, end));
  const closed = data.deals.filter(
    (d) => d.isTerminalWon && within(d.close_date, start, end),
  );

  switch (type) {
    case "gci_cents":
      return closed.reduce((s, d) => s + (d.gci_cents ?? 0), 0);
    case "closed_volume_cents":
      return closed.reduce((s, d) => s + (d.sales_price_cents ?? 0), 0);
    case "closed_deals_count":
      return closed.length;
    case "appointments_count":
      return sumKeys(activity, GROUP_METRIC_KEYS.appointments);
    case "top_of_funnel_count":
      return sumKeys(activity, GROUP_METRIC_KEYS.top_of_funnel);
    default: {
      const metric = DIRECT_METRIC[type];
      return metric ? sumKeys(activity, [metric]) : 0;
    }
  }
}

function sumKeys(rows: GoalActivityRow[], keys: ActivityMetricKey[]): number {
  return rows.reduce(
    (sum, r) => sum + keys.reduce((s, k) => s + (r[k] ?? 0), 0),
    0,
  );
}

/** Progress percent (0–100, capped) for display. */
export function goalProgressPct(actual: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((actual / target) * 100));
}
