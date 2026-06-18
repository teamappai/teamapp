import Link from "next/link";
import { Flame } from "lucide-react";

import { getAgentDashboard } from "@/lib/dashboards/agent";
import type { Database } from "@/types/supabase";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { Sparkline } from "@/components/dashboard/sparkline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

function Widget({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">{children}</CardContent>
    </Card>
  );
}

export async function AgentDashboard({
  userId,
  companyId,
  role,
}: {
  userId: string;
  companyId: string;
  role: Database["public"]["Enums"]["user_role"];
}) {
  const d = await getAgentDashboard({ userId, companyId, role });

  return (
    <div className="space-y-6">
      <QuickActions
        actions={[
          { label: "+ New Deal", href: "/app/deals/new", primary: true },
          { label: "Log today's activity", href: "/app/activity-log" },
          { label: "View my coaching", href: "/app/coaching" },
        ]}
      />

      {!d.activity.loggedToday ? (
        <Link
          href="/app/activity-log"
          className="flex items-center justify-between rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm hover:bg-sky-100 dark:bg-sky-950/30"
        >
          <span className="font-medium text-sky-900 dark:text-sky-200">
            Take 30 seconds to log today&rsquo;s activity →
          </span>
          {d.activity.streak > 0 ? (
            <span className="flex items-center gap-1 text-sky-700 dark:text-sky-300">
              <Flame className="size-4" /> Streak: {d.activity.streak} days
            </span>
          ) : null}
        </Link>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* LEFT 1 — Today's Focus */}
        <Widget title="Today's focus">
          <div className="text-muted-foreground flex flex-wrap gap-x-6 gap-y-1">
            <span>
              <span className="text-foreground font-semibold">
                {d.todaysFocus.pendingRequests}
              </span>{" "}
              pending requests
            </span>
            <span>
              <span className="text-foreground font-semibold">
                {d.todaysFocus.upcomingClosings.length}
              </span>{" "}
              closings (14d)
            </span>
          </div>
          {d.todaysFocus.upcomingClosings.length > 0 ? (
            <ul className="space-y-1">
              {d.todaysFocus.upcomingClosings.slice(0, 3).map((c) => (
                <li key={c.dealId}>
                  <Link
                    href={`/app/deals/${c.dealId}`}
                    className="hover:underline"
                  >
                    {c.property} · {c.closeDate}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          {d.todaysFocus.recentDealUpdates.length > 0 ? (
            <div className="text-muted-foreground space-y-0.5 text-xs">
              <p className="font-medium">Recent deal updates</p>
              {d.todaysFocus.recentDealUpdates.map((u) => (
                <Link
                  key={u.dealId}
                  href={`/app/deals/${u.dealId}`}
                  className="block hover:underline"
                >
                  {u.property} — {u.stage}
                </Link>
              ))}
            </div>
          ) : null}
        </Widget>

        {/* LEFT 2 — My Pipeline */}
        <Widget
          title="My pipeline"
          action={
            <Button asChild size="sm" variant="ghost">
              <Link href="/app/deals">View all</Link>
            </Button>
          }
        >
          <div className="grid grid-cols-2 gap-2">
            {d.pipeline.map((b) => (
              <Link
                key={b.key}
                href={`/app/deals?stage=${encodeURIComponent(b.stageFilter)}`}
                className="hover:bg-accent rounded-md border px-3 py-2"
              >
                <p className="text-muted-foreground text-xs">{b.label}</p>
                <p className="font-semibold">
                  {b.count}{" "}
                  <span className="text-muted-foreground text-xs font-normal">
                    {formatCurrency(b.sumCents, { compact: true })}
                  </span>
                </p>
              </Link>
            ))}
          </div>
        </Widget>

        {/* LEFT 3 — My Coaching */}
        <Widget
          title="My coaching"
          action={
            <Button asChild size="sm" variant="ghost">
              <Link href="/app/coaching">View all</Link>
            </Button>
          }
        >
          {d.goal ? (
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-medium">{d.goal.label}</span>
                <span className="text-muted-foreground tabular-nums">
                  {d.goal.actualText} / {d.goal.targetText}
                </span>
              </div>
              <Progress
                value={d.goal.pct}
                className="h-1.5"
                indicatorClassName="bg-sky-500"
              />
            </div>
          ) : null}
          {d.coachingNotes.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              No coaching notes yet.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {d.coachingNotes.map((n) => (
                <li key={n.id} className="text-xs">
                  <span className="text-muted-foreground">
                    {formatDate(n.occurredAt, "short")}:
                  </span>{" "}
                  {n.body.length > 80 ? `${n.body.slice(0, 80)}…` : n.body}
                </li>
              ))}
            </ul>
          )}
        </Widget>

        {/* LEFT 4 — My Activity Log */}
        <Widget
          title="My activity log"
          action={
            <Button asChild size="sm" variant="ghost">
              <Link href="/app/activity-log">Log today</Link>
            </Button>
          }
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-sm font-medium">
              <Flame className="size-4 text-orange-500" /> {d.activity.streak}
              -day streak
            </span>
            <span className="text-muted-foreground text-xs">
              Yesterday: {d.activity.yesterdayTotal}
            </span>
          </div>
          <Sparkline
            data={d.activity.weekly.map((w) => w.total)}
            className="h-10 w-full"
          />
        </Widget>

        {/* RIGHT 5 — My Training */}
        <Widget
          title="My training"
          action={
            <Button asChild size="sm" variant="ghost">
              <Link href="/app/training">View</Link>
            </Button>
          }
        >
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span>
                {d.training.completed} of {d.training.total} modules
              </span>
              <span className="text-muted-foreground">
                {d.training.percent}%
              </span>
            </div>
            <Progress
              value={d.training.percent}
              className="h-1.5"
              indicatorClassName="bg-emerald-500"
            />
          </div>
          {d.training.nextModule ? (
            <Button asChild size="sm" variant="outline" className="w-full">
              <Link href={`/app/training/${d.training.nextModule.id}`}>
                Continue: {d.training.nextModule.title}
              </Link>
            </Button>
          ) : (
            <p className="text-muted-foreground text-xs">
              All modules complete 🎉
            </p>
          )}
          {d.training.stalled.length > 0 ? (
            <p className="text-xs text-amber-600">
              {d.training.stalled.length} stalled module
              {d.training.stalled.length === 1 ? "" : "s"}
            </p>
          ) : null}
        </Widget>

        {/* RIGHT 6 — My Requests */}
        <Widget
          title="My requests"
          action={
            <Button asChild size="sm" variant="ghost">
              <Link href="/app/requests">View</Link>
            </Button>
          }
        >
          <div className="text-muted-foreground flex flex-wrap gap-x-6 gap-y-1">
            <span>
              <span className="text-foreground font-semibold">
                {d.requests.createdByMeOpen}
              </span>{" "}
              open (created)
            </span>
            <span>
              <span className="text-foreground font-semibold">
                {d.requests.assignedToMeOpen}
              </span>{" "}
              assigned to me
            </span>
          </div>
          {d.requests.statusBreakdown.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {d.requests.statusBreakdown.map((s) => (
                <Badge
                  key={s.status}
                  variant="secondary"
                  className="text-[10px]"
                >
                  {s.status.replace(/_/g, " ")}: {s.count}
                </Badge>
              ))}
            </div>
          ) : null}
        </Widget>

        {/* RIGHT 7 — Recent Messages */}
        <Widget
          title="Recent messages"
          action={
            <Button asChild size="sm" variant="ghost">
              <Link href="/app/messages">Go to messages</Link>
            </Button>
          }
        >
          {d.messages.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              No conversations yet.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {d.messages.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/app/messages/${t.id}`}
                    className="hover:bg-accent flex items-center justify-between gap-2 rounded px-1 py-0.5"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium">{t.name}</span>
                      {t.preview ? (
                        <span className="text-muted-foreground">
                          {" "}
                          — {t.preview}
                        </span>
                      ) : null}
                    </span>
                    {t.unread > 0 ? (
                      <Badge className="text-[10px]">{t.unread}</Badge>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Widget>
      </div>
    </div>
  );
}
