import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { getOnboardingProgress } from "@/lib/training/progress";
import {
  goalWindow,
  computeGoalActual,
  goalProgressPct,
  type GoalActivityRow,
  type GoalDealRow,
} from "@/lib/coaching/goals";
import type { Database } from "@/types/supabase";
import {
  fetchCompanyDeals,
  fetchCompanyUsers,
  dealsForAgent,
  computeDealKpis,
  buildStageCards,
  buildUpcomingClosings,
  type DashDeal,
  type DashUser,
  type DealKpis,
  type StageCard,
  type UpcomingClosing,
} from "@/lib/dashboards/shared";
import { todayIso, addDaysIso } from "@/lib/coaching/dates";

type GoalRow = Database["public"]["Tables"]["goals"]["Row"];

const ACTIVITY_COLS =
  "user_id, log_date, is_off_day, door_knocks, open_houses, conversations, seller_leads_added, buyer_leads_added, pqs, buyer_consults, listing_appts, cma_deliveries, zillow_appts_set, zillow_appts_met, showings, listings_signed, buyer_agreements_signed, offers_submitted";

type ActivityRow = GoalActivityRow & { user_id: string; is_off_day: boolean };

function toGoalDeal(d: DashDeal): GoalDealRow {
  return {
    gci_cents: d.gci_cents,
    sales_price_cents: d.sales_price_cents,
    close_date: d.close_date,
    isTerminalWon: d.isTerminalWon,
  };
}

/** The team-wide goal whose period currently covers today (if any). */
function activeTeamGoal(goals: GoalRow[]): GoalRow | null {
  const today = todayIso();
  const active = goals
    .filter((g) => g.user_id === null)
    .filter((g) => {
      const w = goalWindow(g.period, g.period_start);
      return today >= w.start && today <= w.end;
    })
    .sort((a, b) => (a.period_start < b.period_start ? 1 : -1));
  return active[0] ?? null;
}

export type GoalProgressView = {
  goalType: GoalRow["goal_type"];
  period: GoalRow["period"];
  actual: number;
  target: number;
  pct: number;
} | null;

export type TeamLeadKpis = {
  deals: DealKpis;
  goal: GoalProgressView;
};

export async function getTeamLeadKpis(
  companyId: string,
): Promise<TeamLeadKpis> {
  const service = createServiceClient();
  const [deals, goalsRes, activityRes] = await Promise.all([
    fetchCompanyDeals(companyId),
    service.from("goals").select("*").eq("company_id", companyId),
    service
      .from("activity_logs")
      .select(ACTIVITY_COLS)
      .eq("company_id", companyId),
  ]);

  const goals = (goalsRes.data ?? []) as GoalRow[];
  const activity = (activityRes.data ?? []) as ActivityRow[];

  const goalRow = activeTeamGoal(goals);
  let goal: GoalProgressView = null;
  if (goalRow) {
    const w = goalWindow(goalRow.period, goalRow.period_start);
    const actual = computeGoalActual(goalRow.goal_type, w, {
      activity,
      deals: deals.map(toGoalDeal),
    });
    goal = {
      goalType: goalRow.goal_type,
      period: goalRow.period,
      actual,
      target: Number(goalRow.target_value),
      pct: goalProgressPct(actual, Number(goalRow.target_value)),
    };
  }

  return { deals: computeDealKpis(deals), goal };
}

export async function getStageCards(companyId: string): Promise<StageCard[]> {
  const deals = await fetchCompanyDeals(companyId);
  return buildStageCards(deals);
}

// ── Team performance table ───────────────────────────────────────────────────

export type TeamPerfRow = {
  userId: string;
  name: string | null;
  avatarUrl: string | null;
  goalActual: number | null;
  goalTarget: number | null;
  goalPct: number | null;
  goalType: GoalRow["goal_type"] | null;
  onboardingDone: number;
  onboardingTotal: number;
  onboardingPct: number;
  lastActivity: string | null;
  closedDealsYtd: number;
  closedVolumeYtdCents: number;
  gciYtdCents: number;
};

const inYear = (iso: string | null, year: number) =>
  !!iso && iso.slice(0, 4) === String(year);

export async function getTeamPerformance(
  companyId: string,
): Promise<TeamPerfRow[]> {
  const service = createServiceClient();
  const [users, deals, goalsRes, activityRes] = await Promise.all([
    fetchCompanyUsers(companyId),
    fetchCompanyDeals(companyId),
    service.from("goals").select("*").eq("company_id", companyId),
    service
      .from("activity_logs")
      .select(ACTIVITY_COLS)
      .eq("company_id", companyId),
  ]);
  const goals = (goalsRes.data ?? []) as GoalRow[];
  const activity = (activityRes.data ?? []) as ActivityRow[];
  const year = Number(todayIso().slice(0, 4));
  const today = todayIso();

  const agents = users.filter(
    (u) => u.role === "agent" || u.role === "team_lead",
  );

  const rows = await Promise.all(
    agents.map(async (u) => {
      const onboarding = await getOnboardingProgress(
        service,
        u.id,
        u.role,
        companyId,
      );

      const myDeals = dealsForAgent(deals, u.id);
      const closed = myDeals.filter(
        (d) => d.isTerminalWon && inYear(d.close_date, year),
      );
      const closedDealsYtd = closed.length;
      const closedVolumeYtdCents = closed.reduce(
        (s, d) => s + (d.sales_price_cents ?? 0),
        0,
      );
      const gciYtdCents = closed.reduce((s, d) => s + (d.gci_cents ?? 0), 0);

      const myActivity = activity.filter((a) => a.user_id === u.id);
      const lastActivity =
        myActivity.length > 0
          ? myActivity.reduce(
              (max, a) => (a.log_date > max ? a.log_date : max),
              myActivity[0].log_date,
            )
          : null;

      // Active individual goal (covers today), prefer most recent.
      const myGoal = goals
        .filter((g) => g.user_id === u.id)
        .filter((g) => {
          const w = goalWindow(g.period, g.period_start);
          return today >= w.start && today <= w.end;
        })
        .sort((a, b) => (a.period_start < b.period_start ? 1 : -1))[0];

      let goalActual: number | null = null;
      let goalTarget: number | null = null;
      let goalPct: number | null = null;
      let goalType: GoalRow["goal_type"] | null = null;
      if (myGoal) {
        const w = goalWindow(myGoal.period, myGoal.period_start);
        goalActual = computeGoalActual(myGoal.goal_type, w, {
          activity: myActivity,
          deals: myDeals.map(toGoalDeal),
        });
        goalTarget = Number(myGoal.target_value);
        goalPct = goalProgressPct(goalActual, goalTarget);
        goalType = myGoal.goal_type;
      }

      return {
        userId: u.id,
        name: u.full_name,
        avatarUrl: u.avatar_url,
        goalActual,
        goalTarget,
        goalPct,
        goalType,
        onboardingDone: onboarding.completed,
        onboardingTotal: onboarding.total,
        onboardingPct: onboarding.percent,
        lastActivity,
        closedDealsYtd,
        closedVolumeYtdCents,
        gciYtdCents,
      } satisfies TeamPerfRow;
    }),
  );

  return rows;
}

// ── Coaching attention ───────────────────────────────────────────────────────

export type AttentionTrigger =
  | "no_activity"
  | "below_pace"
  | "stalled_deal"
  | "stalled_training";

export type AttentionItem = {
  userId: string;
  name: string | null;
  avatarUrl: string | null;
  trigger: AttentionTrigger;
  reason: string;
  /** For stalled_deal: the deal to review. */
  dealId?: string;
};

export async function getCoachingAttention(
  companyId: string,
): Promise<AttentionItem[]> {
  const service = createServiceClient();
  const [users, deals, goalsRes, activityRes, progressRes] = await Promise.all([
    fetchCompanyUsers(companyId),
    fetchCompanyDeals(companyId),
    service.from("goals").select("*").eq("company_id", companyId),
    service
      .from("activity_logs")
      .select(ACTIVITY_COLS)
      .eq("company_id", companyId),
    service
      .from("training_progress")
      .select("user_id, status, completed_at, last_viewed_at"),
  ]);
  const goals = (goalsRes.data ?? []) as GoalRow[];
  const activity = (activityRes.data ?? []) as ActivityRow[];
  const progress = (progressRes.data ?? []) as {
    user_id: string;
    status: string;
    completed_at: string | null;
    last_viewed_at: string | null;
  }[];

  const today = todayIso();
  const agents = users.filter((u) => u.role === "agent");
  const items: AttentionItem[] = [];

  for (const u of agents) {
    const myActivity = activity.filter((a) => a.user_id === u.id);
    const lastActivity =
      myActivity.length > 0
        ? myActivity.reduce(
            (max, a) => (a.log_date > max ? a.log_date : max),
            myActivity[0].log_date,
          )
        : null;

    // 1. No activity log in 3+ days (or ever).
    if (!lastActivity || lastActivity < addDaysIso(today, -3)) {
      items.push({
        userId: u.id,
        name: u.full_name,
        avatarUrl: u.avatar_url,
        trigger: "no_activity",
        reason: lastActivity
          ? `No activity since ${lastActivity}`
          : "No activity logged yet",
      });
      continue; // one trigger per agent keeps the widget scannable
    }

    // 2. Below goal pace.
    const myGoal = goals
      .filter((g) => g.user_id === u.id)
      .filter((g) => {
        const w = goalWindow(g.period, g.period_start);
        return today >= w.start && today <= w.end;
      })
      .sort((a, b) => (a.period_start < b.period_start ? 1 : -1))[0];
    if (myGoal) {
      const w = goalWindow(myGoal.period, myGoal.period_start);
      const totalDays =
        Math.round(
          (new Date(`${w.end}T00:00:00`).getTime() -
            new Date(`${w.start}T00:00:00`).getTime()) /
            86_400_000,
        ) + 1;
      const elapsed =
        Math.round(
          (new Date(`${today}T00:00:00`).getTime() -
            new Date(`${w.start}T00:00:00`).getTime()) /
            86_400_000,
        ) + 1;
      const target = Number(myGoal.target_value);
      const pace = (target * Math.min(elapsed, totalDays)) / totalDays;
      const actual = computeGoalActual(myGoal.goal_type, w, {
        activity: myActivity,
        deals: dealsForAgent(deals, u.id).map(toGoalDeal),
      });
      if (actual < pace * 0.9) {
        items.push({
          userId: u.id,
          name: u.full_name,
          avatarUrl: u.avatar_url,
          trigger: "below_pace",
          reason: "Tracking below goal pace",
        });
        continue;
      }
    }

    // 3. Stalled deal (non-terminal, untouched 14+ days). Proxy: updated_at.
    const stalled = dealsForAgent(deals, u.id).find(
      (d) =>
        !d.isTerminalWon &&
        !d.isTerminalLost &&
        d.updated_at.slice(0, 10) < addDaysIso(today, -14),
    );
    if (stalled) {
      items.push({
        userId: u.id,
        name: u.full_name,
        avatarUrl: u.avatar_url,
        trigger: "stalled_deal",
        reason: `Deal stalled in ${stalled.stageName ?? "stage"} 14+ days`,
        dealId: stalled.id,
      });
      continue;
    }

    // 4. Stalled training (no completion in 7+ days, still has modules in flight).
    const myProgress = progress.filter((p) => p.user_id === u.id);
    const hasInProgress = myProgress.some((p) => p.status === "in_progress");
    const lastCompletion = myProgress
      .filter((p) => p.completed_at)
      .map((p) => p.completed_at!.slice(0, 10))
      .sort()
      .at(-1);
    if (
      hasInProgress &&
      (!lastCompletion || lastCompletion < addDaysIso(today, -7))
    ) {
      items.push({
        userId: u.id,
        name: u.full_name,
        avatarUrl: u.avatar_url,
        trigger: "stalled_training",
        reason: "No module completed in 7+ days",
      });
    }
  }

  return items;
}

export async function getUpcomingClosings(
  companyId: string,
): Promise<UpcomingClosing[]> {
  const [deals, users] = await Promise.all([
    fetchCompanyDeals(companyId),
    fetchCompanyUsers(companyId),
  ]);
  const userMap = new Map<string, DashUser>(users.map((u) => [u.id, u]));
  return buildUpcomingClosings(deals, userMap);
}
