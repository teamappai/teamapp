import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import type { UserRole } from "@/lib/constants/roles";
import {
  GROUP_METRIC_KEYS,
  totalActivity,
  type ActivityGroupKey,
  type ActivityMetricKey,
} from "@/lib/constants/activity-metrics";
import {
  addDaysIso,
  inRange,
  rangeDays,
  type DateRange,
} from "@/lib/coaching/dates";
import {
  getPipelineSummary,
  type PipelineSummary,
} from "@/lib/coaching/pipeline";
import {
  computeGoalActual,
  goalDef,
  goalProgressPct,
  goalWindow,
  formatGoalValue,
  type GoalDealRow,
  type GoalType,
  type GoalPeriod,
} from "@/lib/coaching/goals";
import type {
  HeatCell,
  HeatRow,
  LeaderboardRow,
} from "@/lib/coaching/aggregate";

/**
 * Server data access + aggregation for the coaching dashboard. Everything the
 * funnel, heatmap, leaderboard, goals, and coaching log need is fetched here
 * (RLS-scoped) and composed into view models. Activity data flows straight from
 * activity_logs (audit F-114 — no decoupling between logging and coaching).
 */

type ActivityRow = Database["public"]["Tables"]["activity_logs"]["Row"];

export type CoachingUser = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
};

/** A deal shaped for coaching aggregation (GCI/volume + stage + attribution). */
type CoachDeal = {
  id: string;
  gci_cents: number | null;
  sales_price_cents: number | null;
  close_date: string | null;
  representing: Database["public"]["Enums"]["deal_representing"] | null;
  created_by: string | null;
  listing_agent_id: string | null;
  co_listing_agent_id: string | null;
  buyer_agent_id: string | null;
  isTerminalWon: boolean;
};

export type GoalRow = Database["public"]["Tables"]["goals"]["Row"];

// Heatmap is capped to keep the grid readable even on a 90-day range.
const HEATMAP_MAX_DAYS = 35;

// ── low-level fetchers ─────────────────────────────────────────────────────────

async function getCompanyUsers(companyId: string): Promise<CoachingUser[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("users")
    .select("id, full_name, avatar_url, role")
    .eq("company_id", companyId)
    .neq("status", "archived")
    .order("full_name", { ascending: true });
  return (data ?? []) as CoachingUser[];
}

async function getActivitySince(
  companyId: string,
  sinceIso: string,
): Promise<ActivityRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("activity_logs")
    .select("*")
    .eq("company_id", companyId)
    .gte("log_date", sinceIso)
    .order("log_date", { ascending: false });
  return (data ?? []) as ActivityRow[];
}

async function getCompanyDeals(companyId: string): Promise<CoachDeal[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("deals")
    .select(
      `id, gci_cents, sales_price_cents, close_date, representing,
       created_by, listing_agent_id, co_listing_agent_id, buyer_agent_id,
       stage:deal_stages!stage_id (is_terminal_won)`,
    )
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .eq("is_draft", false);
  return (
    (data ?? []) as unknown as Array<
      Omit<CoachDeal, "isTerminalWon"> & {
        stage: { is_terminal_won: boolean } | null;
      }
    >
  ).map((d) => ({
    id: d.id,
    gci_cents: d.gci_cents,
    sales_price_cents: d.sales_price_cents,
    close_date: d.close_date,
    representing: d.representing,
    created_by: d.created_by,
    listing_agent_id: d.listing_agent_id,
    co_listing_agent_id: d.co_listing_agent_id,
    buyer_agent_id: d.buyer_agent_id,
    isTerminalWon: !!d.stage?.is_terminal_won,
  }));
}

async function getGoals(companyId: string): Promise<GoalRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("goals")
    .select("*")
    .eq("company_id", companyId)
    .order("period_start", { ascending: false });
  return (data ?? []) as GoalRow[];
}

export type CoachingEntry = {
  id: string;
  body: string;
  occurred_at: string;
  is_test: boolean;
  agentName: string;
  coachName: string;
  agentUserId: string;
};

async function getCoachingEntries(
  agentIds: string[],
  users: Map<string, CoachingUser>,
): Promise<CoachingEntry[]> {
  if (agentIds.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("coaching_log_entries")
    .select("id, body, occurred_at, is_test, agent_user_id, coach_user_id")
    .in("agent_user_id", agentIds)
    .order("occurred_at", { ascending: false });
  return (data ?? []).map((e) => ({
    id: e.id,
    body: e.body,
    occurred_at: e.occurred_at,
    is_test: e.is_test,
    agentUserId: e.agent_user_id,
    agentName: users.get(e.agent_user_id)?.full_name ?? "Unknown",
    coachName: e.coach_user_id
      ? (users.get(e.coach_user_id)?.full_name ?? "Unknown")
      : "System",
  }));
}

// ── pure aggregation ───────────────────────────────────────────────────────────

function sumGroup(rows: ActivityRow[], group: ActivityGroupKey): number {
  return rows.reduce(
    (sum, r) =>
      sum +
      GROUP_METRIC_KEYS[group].reduce(
        (s, k) => s + ((r[k as ActivityMetricKey] as number) ?? 0),
        0,
      ),
    0,
  );
}

function sumMetric(rows: ActivityRow[], key: ActivityMetricKey): number {
  return rows.reduce((s, r) => s + ((r[key] as number) ?? 0), 0);
}

/** The agent credited with a deal for leaderboard attribution. */
function primaryAgentId(d: CoachDeal): string | null {
  if (d.representing === "buyer") {
    return d.buyer_agent_id ?? d.listing_agent_id ?? d.created_by;
  }
  return d.listing_agent_id ?? d.buyer_agent_id ?? d.created_by;
}

export type FunnelTotals = {
  topOfFunnel: number;
  appointments: number;
  pipeline: number;
  showings: number;
  offers: number;
};

export function funnelTotals(rows: ActivityRow[]): FunnelTotals {
  return {
    topOfFunnel: sumGroup(rows, "top_of_funnel"),
    appointments: sumGroup(rows, "appointments"),
    pipeline: sumGroup(rows, "pipeline"),
    showings: sumMetric(rows, "showings"),
    offers: sumMetric(rows, "offers_submitted"),
  };
}

function buildLeaderboard(
  agents: CoachingUser[],
  activity: ActivityRow[],
  deals: CoachDeal[],
  goals: GoalRow[],
  range: DateRange,
): LeaderboardRow[] {
  return agents.map((agent) => {
    const ownRangeActivity = activity.filter(
      (r) => r.user_id === agent.id && inRange(r.log_date, range),
    );
    const ownAll = activity.filter((r) => r.user_id === agent.id);
    const closed = deals.filter(
      (d) =>
        d.isTerminalWon &&
        primaryAgentId(d) === agent.id &&
        inRange(d.close_date, range),
    );
    // Primary outcome goal for the chip: prefer GCI, else first outcome goal.
    const outcomeGoals = goals.filter(
      (g) =>
        g.user_id === agent.id && goalDef(g.goal_type).category === "outcome",
    );
    const primaryGoal =
      outcomeGoals.find((g) => g.goal_type === "gci_cents") ?? outcomeGoals[0];
    const lastLog = ownAll.length
      ? ownAll.reduce(
          (max, r) => (r.log_date > max ? r.log_date : max),
          ownAll[0].log_date,
        )
      : null;
    return {
      userId: agent.id,
      name: agent.full_name ?? "Unnamed",
      avatarUrl: agent.avatar_url,
      goalLabel: primaryGoal
        ? `${goalDef(primaryGoal.goal_type).label} ${formatGoalValue(
            primaryGoal.goal_type,
            primaryGoal.target_value,
          )}`
        : null,
      gciCents: closed.reduce((s, d) => s + (d.gci_cents ?? 0), 0),
      closedVolumeCents: closed.reduce(
        (s, d) => s + (d.sales_price_cents ?? 0),
        0,
      ),
      closedDeals: closed.length,
      appointments: sumGroup(ownRangeActivity, "appointments"),
      conversations: sumMetric(ownRangeActivity, "conversations"),
      lastActivityAt: lastLog,
    };
  });
}

function buildHeatmap(
  agents: CoachingUser[],
  activity: ActivityRow[],
  range: DateRange,
): { dates: string[]; rows: HeatRow[] } {
  const span = Math.min(rangeDays(range), HEATMAP_MAX_DAYS);
  const dates: string[] = [];
  for (let i = span - 1; i >= 0; i--) dates.push(addDaysIso(range.to, -i));

  // Index activity by `${user}:${date}` for O(1) cell lookup.
  const byKey = new Map<string, ActivityRow>();
  for (const r of activity) byKey.set(`${r.user_id}:${r.log_date}`, r);

  const rows: HeatRow[] = agents.map((agent) => ({
    userId: agent.id,
    name: agent.full_name ?? "Unnamed",
    avatarUrl: agent.avatar_url,
    cells: dates.map((date): HeatCell => {
      const row = byKey.get(`${agent.id}:${date}`);
      if (!row) return { date, total: 0, isOffDay: false, empty: true };
      return {
        date,
        total: row.is_off_day ? 0 : totalActivity(row),
        isOffDay: row.is_off_day,
        empty: false,
      };
    }),
  }));
  return { dates, rows };
}

export type GoalProgress = {
  id: string;
  goalType: GoalType;
  label: string;
  period: GoalPeriod;
  periodStart: string;
  target: number;
  actual: number;
  pct: number;
  format: "currency" | "count";
  targetDisplay: string;
  actualDisplay: string;
  userId: string | null;
  setByName: string | null;
};

function dealsToGoalRows(
  deals: CoachDeal[],
  userId: string | null,
): GoalDealRow[] {
  const scoped = userId
    ? deals.filter((d) => primaryAgentId(d) === userId)
    : deals;
  return scoped.map((d) => ({
    gci_cents: d.gci_cents,
    sales_price_cents: d.sales_price_cents,
    close_date: d.close_date,
    isTerminalWon: d.isTerminalWon,
  }));
}

function buildGoalProgress(
  goals: GoalRow[],
  activity: ActivityRow[],
  deals: CoachDeal[],
  users: Map<string, CoachingUser>,
): GoalProgress[] {
  return goals.map((g) => {
    const window = goalWindow(g.period, g.period_start);
    const scopedActivity = (
      g.user_id ? activity.filter((r) => r.user_id === g.user_id) : activity
    ).map((r) => ({ ...r }));
    const actual = computeGoalActual(g.goal_type, window, {
      activity: scopedActivity,
      deals: dealsToGoalRows(deals, g.user_id),
    });
    const def = goalDef(g.goal_type);
    return {
      id: g.id,
      goalType: g.goal_type,
      label: def.label,
      period: g.period,
      periodStart: g.period_start,
      target: g.target_value,
      actual,
      pct: goalProgressPct(actual, g.target_value),
      format: def.format,
      targetDisplay: formatGoalValue(g.goal_type, g.target_value),
      actualDisplay: formatGoalValue(g.goal_type, actual),
      userId: g.user_id,
      setByName: g.set_by_user_id
        ? (users.get(g.set_by_user_id)?.full_name ?? null)
        : null,
    };
  });
}

// ── orchestrators ──────────────────────────────────────────────────────────────

export type CoachingDashboard = {
  agents: CoachingUser[];
  funnel: FunnelTotals;
  pipeline: PipelineSummary;
  leaderboard: LeaderboardRow[];
  heatmap: { dates: string[]; rows: HeatRow[] };
  /** Progress for every goal in scope (team + agent). */
  goalProgress: GoalProgress[];
  /** Team-wide goals only (user_id IS NULL), for the Goals vs Actuals card. */
  teamGoals: GoalProgress[];
  entries: CoachingEntry[];
};

/**
 * Fetch + compose everything the team/super_admin coaching view renders.
 * `scopeUserId` narrows the funnel/pipeline/heatmap/leaderboard/entries to a
 * single agent (the self-scoped agent variant); omit it for the full team view.
 */
export async function getCoachingDashboard(args: {
  companyId: string;
  range: DateRange;
  scopeUserId?: string | null;
}): Promise<CoachingDashboard> {
  const { companyId, range } = args;
  const yearStart = `${range.to.slice(0, 4)}-01-01`;
  const since = range.from < yearStart ? range.from : yearStart;

  const [allUsers, activityAll, deals, goals, pipeline] = await Promise.all([
    getCompanyUsers(companyId),
    getActivitySince(companyId, since),
    getCompanyDeals(companyId),
    getGoals(companyId),
    getPipelineSummary({
      companyId,
      userId: args.scopeUserId ?? null,
      range,
    }),
  ]);

  const users = new Map(allUsers.map((u) => [u.id, u]));
  let agents = allUsers.filter((u) => u.role === "agent");
  if (args.scopeUserId)
    agents = agents.filter((a) => a.id === args.scopeUserId);

  const agentIds = new Set(agents.map((a) => a.id));
  const scopedActivity = args.scopeUserId
    ? activityAll.filter((r) => agentIds.has(r.user_id))
    : activityAll;
  const rangeActivity = scopedActivity.filter((r) =>
    inRange(r.log_date, range),
  );

  const entryAgentIds = args.scopeUserId
    ? [args.scopeUserId]
    : allUsers.filter((u) => u.role === "agent").map((u) => u.id);
  const entries = await getCoachingEntries(entryAgentIds, users);

  // Progress for the relevant goals: scoped to the agent, or team + all agents.
  const relevantGoals = args.scopeUserId
    ? goals.filter((g) => g.user_id === args.scopeUserId)
    : goals;
  const goalProgress = buildGoalProgress(
    relevantGoals,
    activityAll,
    deals,
    users,
  );
  const teamGoals = buildGoalProgress(
    goals.filter((g) => g.user_id === null),
    activityAll,
    deals,
    users,
  );

  return {
    agents,
    funnel: funnelTotals(rangeActivity),
    pipeline,
    leaderboard: buildLeaderboard(agents, scopedActivity, deals, goals, range),
    heatmap: buildHeatmap(agents, scopedActivity, range),
    goalProgress,
    teamGoals,
    entries,
  };
}

/** Just the leaderboard rows (for an agent's optional full-leaderboard view). */
export async function getLeaderboardRows(
  companyId: string,
  range: DateRange,
): Promise<LeaderboardRow[]> {
  const yearStart = `${range.to.slice(0, 4)}-01-01`;
  const since = range.from < yearStart ? range.from : yearStart;
  const [allUsers, activity, deals, goals] = await Promise.all([
    getCompanyUsers(companyId),
    getActivitySince(companyId, since),
    getCompanyDeals(companyId),
    getGoals(companyId),
  ]);
  const agents = allUsers.filter((u) => u.role === "agent");
  return buildLeaderboard(agents, activity, deals, goals, range);
}

/** Goal-progress rows for one agent (their personal goals). */
export async function getAgentGoals(
  companyId: string,
  userId: string,
): Promise<GoalProgress[]> {
  const yearStart = `${new Date().getFullYear()}-01-01`;
  const [activity, deals, goals, users] = await Promise.all([
    getActivitySince(companyId, yearStart),
    getCompanyDeals(companyId),
    getGoals(companyId),
    getCompanyUsers(companyId).then(
      (u) => new Map(u.map((x) => [x.id, x] as const)),
    ),
  ]);
  return buildGoalProgress(
    goals.filter((g) => g.user_id === userId),
    activity,
    deals,
    users,
  );
}
