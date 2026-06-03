import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getSessionProfile } from "@/lib/auth/profile";
import { ROLE_LABELS } from "@/lib/constants/roles";
import { resolveDashRange } from "@/lib/dashboards/range";
import {
  getDrillUser,
  getDrillOverview,
  getDrillDeals,
  getDrillActivity,
  getDrillCoaching,
  getDrillTrainingSummary,
} from "@/lib/dashboards/drill-down";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { dayGroupLabel } from "@/lib/coaching/dates";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { KpiCard } from "@/components/admin/kpi-card";
import { DashDateRangeSelect } from "@/components/dashboard/date-range-select";
import { Sparkline } from "@/components/dashboard/sparkline";
import { DrillDownActions } from "@/components/users/drill-down-actions";
import { DrillDownGoals } from "@/components/users/drill-down-goals";
import { DrillDownCoaching } from "@/components/users/drill-down-coaching";
import { DrillDownTraining } from "@/components/users/drill-down-training";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = { title: "Agent · TeamApp" };

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "deals", label: "Deals" },
  { key: "activity", label: "Activity" },
  { key: "coaching", label: "Coaching" },
  { key: "training", label: "Training" },
] as const;

type Tab = (typeof TABS)[number]["key"];

export default async function UserDrillDownPage({
  params,
  searchParams,
}: {
  params: Promise<{ agentId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await getSessionProfile();
  if (!session) redirect("/login");

  const viewerRole = session.profile.role;
  // Defense in depth (middleware already gates): only team_lead/admin_tc/super.
  if (
    viewerRole !== "team_lead" &&
    viewerRole !== "admin_tc" &&
    viewerRole !== "super_admin"
  ) {
    notFound();
  }

  const { agentId } = await params;
  const sp = await searchParams;
  const agent = await getDrillUser(agentId);
  if (!agent) notFound();

  // Same-company guard (super_admin may cross companies).
  if (
    viewerRole !== "super_admin" &&
    agent.companyId !== session.profile.company_id
  ) {
    notFound();
  }

  const tab = (TABS.find((t) => t.key === sp.tab)?.key ?? "overview") as Tab;
  const agentRef = { id: agent.id, name: agent.fullName ?? "Agent" };
  const canCoach = viewerRole === "team_lead" || viewerRole === "super_admin";
  const repliesHidden = viewerRole === "admin_tc";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <UserAvatar
            name={agent.fullName}
            src={agent.avatarUrl}
            seed={agent.id}
            size="lg"
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">
                {agent.fullName ?? "Agent"}
              </h1>
              <Badge variant="secondary">{ROLE_LABELS[agent.role]}</Badge>
            </div>
            <p className="text-muted-foreground text-sm">
              Joined {formatDate(agent.joinedAt, "short")}
              {agent.lastActivity
                ? ` · Last activity ${formatDate(agent.lastActivity, "relative")}`
                : " · No activity yet"}
            </p>
          </div>
        </div>
        <DrillDownActions agent={agentRef} canCoach={canCoach} />
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="-mb-px flex gap-4">
          {TABS.map((t) => {
            const active = t.key === tab;
            return (
              <Link
                key={t.key}
                href={`/app/users/${agent.id}?tab=${t.key}`}
                className={
                  active
                    ? "border-primary text-foreground border-b-2 pb-2 text-sm font-medium"
                    : "text-muted-foreground hover:text-foreground border-b-2 border-transparent pb-2 text-sm"
                }
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {tab === "overview" ? (
        <OverviewTab agent={agent} canCoach={canCoach} agentRef={agentRef} />
      ) : null}
      {tab === "deals" ? <DealsTab agent={agent} sp={sp} /> : null}
      {tab === "activity" ? <ActivityTab agent={agent} sp={sp} /> : null}
      {tab === "coaching" ? (
        <CoachingTab
          agent={agent}
          agentRef={agentRef}
          viewerRole={viewerRole}
          canCoach={canCoach}
          canReply={canCoach}
          repliesHidden={repliesHidden}
        />
      ) : null}
      {tab === "training" ? (
        <TrainingTab agent={agent} agentRef={agentRef} canCoach={canCoach} />
      ) : null}
    </div>
  );
}

async function OverviewTab({
  agent,
  canCoach,
  agentRef,
}: {
  agent: Awaited<ReturnType<typeof getDrillUser>>;
  canCoach: boolean;
  agentRef: { id: string; name: string };
}) {
  if (!agent) return null;
  const o = await getDrillOverview(agent);
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Closed deals YTD" value={String(o.closedDealsYtd)} />
        <KpiCard
          label="GCI YTD"
          value={formatCurrency(o.gciYtdCents, { compact: true })}
        />
        <KpiCard
          label="Volume YTD"
          value={formatCurrency(o.volumeYtdCents, { compact: true })}
        />
        <KpiCard
          label="Onboarding"
          value={`${o.training.percent}%`}
          hint={`${o.training.completed} of ${o.training.total} modules`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 py-4">
            <h2 className="text-sm font-semibold">Goals</h2>
            <DrillDownGoals
              goals={o.goals}
              agent={agentRef}
              canEdit={canCoach}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Recent coaching</h2>
              <Link
                href={`/app/users/${agent.id}?tab=coaching`}
                className="text-xs text-sky-600 hover:underline"
              >
                View all
              </Link>
            </div>
            {o.recentCoaching.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No coaching notes yet.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {o.recentCoaching.map((n) => (
                  <li key={n.id} className="text-sm">
                    <span className="text-muted-foreground text-xs">
                      {formatDate(n.occurredAt, "short")}:
                    </span>{" "}
                    {n.body.length > 100 ? `${n.body.slice(0, 100)}…` : n.body}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 py-4">
            <h2 className="text-sm font-semibold">Recent deals</h2>
            {o.recentDeals.length === 0 ? (
              <p className="text-muted-foreground text-sm">No deals yet.</p>
            ) : (
              <ul className="space-y-1">
                {o.recentDeals.map((d) => (
                  <li key={d.id} className="text-sm">
                    <Link
                      href={`/app/deals/${d.id}`}
                      className="hover:underline"
                    >
                      {d.property}
                    </Link>{" "}
                    <span className="text-muted-foreground text-xs">
                      — {d.stage}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 py-4">
            <h2 className="text-sm font-semibold">Recent requests</h2>
            {o.recentRequests.length === 0 ? (
              <p className="text-muted-foreground text-sm">No requests yet.</p>
            ) : (
              <ul className="space-y-1">
                {o.recentRequests.map((r) => (
                  <li key={r.id} className="text-sm">
                    <Link
                      href={`/app/requests/${r.id}`}
                      className="hover:underline"
                    >
                      {r.title}
                    </Link>{" "}
                    <span className="text-muted-foreground text-xs">
                      — {r.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

async function DealsTab({
  agent,
  sp,
}: {
  agent: NonNullable<Awaited<ReturnType<typeof getDrillUser>>>;
  sp: Record<string, string | undefined>;
}) {
  const range = resolveDashRange({
    range: sp.dRange,
    from: sp.dFrom,
    to: sp.dTo,
  });
  const deals = await getDrillDeals(agent, range);
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <DashDateRangeSelect range={range} paramPrefix="d" />
      </div>
      {deals.length === 0 ? (
        <p className="text-muted-foreground rounded-md border py-8 text-center text-sm">
          No deals created in this range.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Property</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead className="text-right">Sales price</TableHead>
                <TableHead className="text-right">GCI</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Close date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deals.map((d) => (
                <TableRow key={d.id} className="cursor-default">
                  <TableCell>
                    <Link
                      href={`/app/deals/${d.id}`}
                      className="font-medium hover:underline"
                    >
                      {d.property}
                    </Link>
                  </TableCell>
                  <TableCell className="capitalize">{d.representing}</TableCell>
                  <TableCell>{d.stage}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {d.salesPriceCents !== null
                      ? formatCurrency(d.salesPriceCents, { compact: true })
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {d.gciCents !== null
                      ? formatCurrency(d.gciCents, { compact: true })
                      : "—"}
                  </TableCell>
                  <TableCell>{formatDate(d.createdAt, "short")}</TableCell>
                  <TableCell>{d.closeDate ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

async function ActivityTab({
  agent,
  sp,
}: {
  agent: NonNullable<Awaited<ReturnType<typeof getDrillUser>>>;
  sp: Record<string, string | undefined>;
}) {
  const range = resolveDashRange({
    range: sp.aRange,
    from: sp.aFrom,
    to: sp.aTo,
  });
  const { rows, weekly } = await getDrillActivity(agent, range);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Sparkline data={weekly.map((w) => w.total)} className="h-10 w-40" />
        <DashDateRangeSelect range={range} paramPrefix="a" />
      </div>
      {rows.length === 0 ? (
        <p className="text-muted-foreground rounded-md border py-8 text-center text-sm">
          No activity logged in this range.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id}>
              <Card>
                <CardContent className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-medium">
                      {dayGroupLabel(r.logDate)}{" "}
                      <span className="text-muted-foreground text-xs">
                        ({formatDate(r.logDate, "short")})
                      </span>
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {r.isOffDay
                        ? "Off day"
                        : Object.entries(r.metrics)
                            .filter(([, v]) => v > 0)
                            .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
                            .join(" · ") || "No activity"}
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">
                    {r.total}
                  </span>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function CoachingTab({
  agent,
  agentRef,
  viewerRole,
  canCoach,
  canReply,
  repliesHidden,
}: {
  agent: NonNullable<Awaited<ReturnType<typeof getDrillUser>>>;
  agentRef: { id: string; name: string };
  viewerRole: "team_lead" | "admin_tc" | "super_admin";
  canCoach: boolean;
  canReply: boolean;
  repliesHidden: boolean;
}) {
  const notes = await getDrillCoaching(agent, viewerRole);
  return (
    <DrillDownCoaching
      notes={notes}
      agent={agentRef}
      canCoach={canCoach}
      canReply={canReply}
      repliesHidden={repliesHidden}
    />
  );
}

async function TrainingTab({
  agent,
  agentRef,
  canCoach,
}: {
  agent: NonNullable<Awaited<ReturnType<typeof getDrillUser>>>;
  agentRef: { id: string; name: string };
  canCoach: boolean;
}) {
  const training = await getDrillTrainingSummary(agent);
  return (
    <DrillDownTraining
      training={training}
      agent={agentRef}
      canCoach={canCoach}
    />
  );
}
