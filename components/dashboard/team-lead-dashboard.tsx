import Link from "next/link";

import {
  getTeamLeadKpis,
  getStageCards,
  getTeamPerformance,
  getCoachingAttention,
  getUpcomingClosings,
} from "@/lib/dashboards/team-lead";
import {
  fetchCompanyUsers,
  getActivityFeed,
  type DashUser,
} from "@/lib/dashboards/shared";
import { resolveDashRange } from "@/lib/dashboards/range";
import { formatCurrency } from "@/lib/utils/format";
import { formatGoalValue as goalValue } from "@/lib/coaching/goals";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { StageCardTile } from "@/components/dashboard/stage-card";
import { DashSection } from "@/components/dashboard/section";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { DashDateRangeSelect } from "@/components/dashboard/date-range-select";
import { TeamPerformanceTable } from "@/components/dashboard/team-performance-table";
import { CoachingAttention } from "@/components/dashboard/coaching-attention";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { Card, CardContent } from "@/components/ui/card";

function yoy(current: number, prior: number): number | null {
  if (prior <= 0) return null;
  return Math.round(((current - prior) / prior) * 100);
}

export async function TeamLeadDashboard({
  greeting,
  companyId,
  viewerId,
  searchParams,
}: {
  greeting: string;
  companyId: string;
  viewerId: string;
  searchParams: { range?: string; from?: string; to?: string };
}) {
  const range = resolveDashRange(searchParams);

  const [kpis, stageCards, team, attention, closings, users] =
    await Promise.all([
      getTeamLeadKpis(companyId),
      getStageCards(companyId),
      getTeamPerformance(companyId),
      getCoachingAttention(companyId),
      getUpcomingClosings(companyId),
      fetchCompanyUsers(companyId),
    ]);

  const userMap = new Map<string, DashUser>(users.map((u) => [u.id, u]));
  const feed = await getActivityFeed({
    viewerId,
    users: userMap,
    limit: 50,
    fmtCurrency: (cents) => formatCurrency(cents, { compact: true }),
  });

  const { deals, goal } = kpis;

  return (
    <div className="space-y-8">
      <PageHeader
        title={greeting}
        description="Your team at a glance."
        dateRange={<DashDateRangeSelect range={range} />}
      />

      <QuickActions
        actions={[
          { label: "+ New deal", href: "/app/deals/new", primary: true },
          { label: "+ Invite agent", href: "/app/users" },
          { label: "+ New request", href: "/app/requests/new" },
          { label: "View coaching", href: "/app/coaching" },
          { label: "View team", href: "/app/users" },
        ]}
      />

      {/* Section 2 — Top KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          kpiKey="ytd_gci"
          value={formatCurrency(deals.ytdGciCents, { compact: true })}
          sparkline={deals.gciSparkline}
          yoyPct={yoy(deals.ytdGciCents, deals.lastYearGciCents)}
        />
        <KpiCard
          kpiKey="ytd_volume"
          value={formatCurrency(deals.ytdVolumeCents, { compact: true })}
          sparkline={deals.volumeSparkline}
          yoyPct={yoy(deals.ytdVolumeCents, deals.lastYearVolumeCents)}
        />
        <KpiCard
          kpiKey="pipeline_value"
          value={formatCurrency(deals.pipelineValueCents, { compact: true })}
        />
        <KpiCard
          kpiKey="goal_progress"
          value={
            goal
              ? `${goalValue(goal.goalType, goal.actual)} / ${goalValue(goal.goalType, goal.target)}`
              : "No goal set"
          }
          progressPct={goal ? goal.pct : null}
        />
      </div>

      {/* Section 3 — Real estate stages */}
      <DashSection
        title="Pipeline by stage"
        subtitle="Live counts and value across each real-estate deal stage."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {stageCards.map((c) => (
            <StageCardTile key={c.key} card={c} />
          ))}
        </div>
      </DashSection>

      {/* Section 4 — Team performance */}
      <DashSection
        title="Team performance"
        subtitle="Closed deals, volume, and onboarding status for each agent on your team."
      >
        <TeamPerformanceTable rows={team} />
      </DashSection>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Section 5 — Coaching attention */}
        <DashSection
          title="Needs your attention"
          subtitle="Agents who may need a check-in, coaching, or a nudge."
        >
          <CoachingAttention items={attention} />
        </DashSection>

        {/* Section 6 — Upcoming closings */}
        <DashSection
          title="Upcoming closings"
          subtitle="Deals closing in the next 30 days."
        >
          {closings.length === 0 ? (
            <p className="text-muted-foreground rounded-md border py-8 text-center text-sm">
              No closings scheduled in the next 30 days.
            </p>
          ) : (
            <Card>
              <CardContent className="divide-border divide-y p-0">
                {closings.map((c) => (
                  <Link
                    key={c.dealId}
                    href={`/app/deals/${c.dealId}`}
                    className="hover:bg-accent flex items-center justify-between gap-3 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {c.property}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {c.agentName ?? "Unassigned"} · {c.closeDate} ·{" "}
                        {c.daysUntil === 0 ? "today" : `in ${c.daysUntil}d`}
                      </p>
                    </div>
                    <span className="text-sm font-medium tabular-nums">
                      {c.valueCents !== null
                        ? formatCurrency(c.valueCents, { compact: true })
                        : "—"}
                    </span>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </DashSection>
      </div>

      {/* Section 7 — Recent activity */}
      <DashSection
        title="Recent activity"
        subtitle="Everything happening across your team."
      >
        <ActivityFeed
          initial={feed}
          rangeFrom={range.from}
          rangeTo={range.to}
        />
      </DashSection>
    </div>
  );
}
