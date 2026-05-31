import type { Metadata } from "next";

import { getSessionProfile } from "@/lib/auth/profile";
import { NotAuthorizedError } from "@/lib/auth/require-super-admin";
import { canViewCoaching, isCoachRole } from "@/lib/coaching/access";
import { scopedTitle } from "@/lib/constants/roles";
import { resolveRange } from "@/lib/coaching/dates";
import {
  getCoachingDashboard,
  getLeaderboardRows,
  type GoalProgress,
} from "@/lib/coaching/queries";
import { getCompanySettings } from "@/lib/team/config";
import {
  COACHING_KPI_DEFINITIONS,
  type CoachingKpiInput,
} from "@/lib/kpi/definitions";
import { formatNumber } from "@/lib/utils/format";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { KpiCard } from "@/components/admin/kpi-card";
import { LineChart } from "lucide-react";
import { DateRangeSelect } from "@/components/coaching/date-range-select";
import { FunnelChart } from "@/components/coaching/funnel-chart";
import { GoalsVsActuals } from "@/components/coaching/goals-vs-actuals";
import { ActivityHeatmap } from "@/components/coaching/activity-heatmap";
import { Leaderboard } from "@/components/coaching/leaderboard";
import { CoachingLog } from "@/components/coaching/coaching-log";
import { AgentGoals } from "@/components/coaching/agent-goals";

export const metadata: Metadata = { title: "Coaching · TeamApp" };

function groupGoalsByAgent(
  goals: GoalProgress[],
): Record<string, GoalProgress[]> {
  const out: Record<string, GoalProgress[]> = {};
  for (const g of goals) {
    if (g.userId) (out[g.userId] ??= []).push(g);
  }
  return out;
}

export default async function CoachingPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const session = await getSessionProfile();
  if (!session || !canViewCoaching(session.profile.role)) {
    throw new NotAuthorizedError();
  }
  const role = session.profile.role;
  const companyId = session.profile.company_id;
  const userId = session.user.id;

  const title = scopedTitle(role, { agent: "My Coaching" }, "Coaching");

  // super_admin (and anyone without a company) has no team-scoped funnel.
  if (!companyId) {
    return (
      <div className="space-y-6">
        <PageHeader title={title} description="Team performance coaching." />
        <EmptyState
          icon={LineChart}
          title="Company-scoped"
          description="Coaching aggregates a single team's activity. Switch to a company (or impersonate a team lead) to use it."
        />
      </div>
    );
  }

  const sp = await searchParams;
  const range = resolveRange(sp);
  const isCoach = isCoachRole(role);
  const devMode = process.env.NODE_ENV !== "production";

  const [dash, settings] = await Promise.all([
    getCoachingDashboard({
      companyId,
      range,
      scopeUserId: isCoach ? null : userId,
    }),
    getCompanySettings(companyId),
  ]);

  const kpiInput: CoachingKpiInput = {
    topOfFunnel: dash.funnel.topOfFunnel,
    appointments: dash.funnel.appointments,
    pipeline: dash.funnel.pipeline,
    showings: dash.funnel.showings,
    offers: dash.funnel.offers,
    underContract: dash.pipeline.underContract,
    closed: dash.pipeline.closedInPeriod,
  };
  const kpis = COACHING_KPI_DEFINITIONS.map((k) => ({
    key: k.key,
    label: k.label,
    value: formatNumber(k.compute(kpiInput)),
    helperText: k.helperText,
  }));

  const agentOptions = dash.agents.map((a) => ({
    id: a.id,
    name: a.full_name ?? "Unnamed",
  }));

  const header = (
    <PageHeader
      title={title}
      description="Activity, conversion, and goals across your team."
      dateRange={<DateRangeSelect range={range} />}
    />
  );

  const kpiGrid = (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      {kpis.map((k) => (
        <KpiCard
          key={k.key}
          label={k.label}
          value={k.value}
          hint={k.helperText}
        />
      ))}
    </div>
  );

  // ── Coach (team_lead / admin_tc / super_admin-with-company) view ──────────
  if (isCoach) {
    const goalsByAgent = groupGoalsByAgent(dash.goalProgress);
    return (
      <div className="space-y-6">
        {header}
        {kpiGrid}
        <div className="grid gap-4 lg:grid-cols-2">
          <FunnelChart input={kpiInput} />
          <GoalsVsActuals teamGoals={dash.teamGoals} />
        </div>
        <ActivityHeatmap dates={dash.heatmap.dates} rows={dash.heatmap.rows} />
        <Leaderboard
          rows={dash.leaderboard}
          goalsByAgent={goalsByAgent}
          isCoach
        />
        <CoachingLog
          entries={dash.entries}
          canDelete
          canAddNote
          devMode={devMode}
          agents={agentOptions}
        />
      </div>
    );
  }

  // ── Agent (self-scoped) view ──────────────────────────────────────────────
  const fullLeaderboard = settings.leaderboardVisibleToAgents
    ? await getLeaderboardRows(companyId, range)
    : null;
  const agentName = session.profile.full_name ?? "Me";

  return (
    <div className="space-y-6">
      {header}
      {kpiGrid}
      <div className="grid gap-4 lg:grid-cols-2">
        <FunnelChart input={kpiInput} />
        <AgentGoals
          userId={userId}
          agentName={agentName}
          goals={dash.goalProgress}
        />
      </div>
      <ActivityHeatmap dates={dash.heatmap.dates} rows={dash.heatmap.rows} />
      {fullLeaderboard ? (
        <Leaderboard
          rows={fullLeaderboard}
          goalsByAgent={{}}
          isCoach={false}
          highlightUserId={userId}
        />
      ) : null}
      <CoachingLog
        entries={dash.entries}
        canDelete={false}
        canAddNote={false}
        devMode={devMode}
        agents={[]}
      />
    </div>
  );
}
