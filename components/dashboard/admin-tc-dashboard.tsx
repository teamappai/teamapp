import Link from "next/link";

import { getAdminTcDashboard } from "@/lib/dashboards/admin-tc";
import {
  fetchCompanyUsers,
  getActivityFeed,
  type DashUser,
} from "@/lib/dashboards/shared";
import type { Database } from "@/types/supabase";
import { formatCurrency } from "@/lib/utils/format";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { DashSection } from "@/components/dashboard/section";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function Widget({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">{children}</CardContent>
    </Card>
  );
}

export async function AdminTcDashboard({
  userId,
  companyId,
  role,
}: {
  userId: string;
  companyId: string;
  role: Database["public"]["Enums"]["user_role"];
}) {
  const [d, users] = await Promise.all([
    getAdminTcDashboard({ userId, companyId, role }),
    fetchCompanyUsers(companyId),
  ]);
  const userMap = new Map<string, DashUser>(users.map((u) => [u.id, u]));
  const feed = await getActivityFeed({
    viewerId: userId,
    users: userMap,
    limit: 50,
    fmtCurrency: (c) => formatCurrency(c, { compact: true }),
  });

  return (
    <div className="space-y-6">
      <QuickActions
        actions={[
          { label: "+ New request", href: "/app/requests/new", primary: true },
          { label: "View my queue", href: "/app/requests" },
          { label: "+ Add new deal", href: "/app/deals/new" },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Today's Focus */}
        <Widget title="Today's focus">
          <div className="text-muted-foreground flex flex-wrap gap-x-6 gap-y-1">
            <span>
              <span className="text-foreground font-semibold">
                {d.todaysFocus.overdue.length}
              </span>{" "}
              overdue
            </span>
            <span>
              <span className="text-foreground font-semibold">
                {d.todaysFocus.readyForReview}
              </span>{" "}
              ready for review
            </span>
            <span>
              <span className="text-foreground font-semibold">
                {d.todaysFocus.highPriority}
              </span>{" "}
              high priority
            </span>
          </div>
          {d.todaysFocus.overdue.length > 0 ? (
            <ul className="space-y-1">
              {d.todaysFocus.overdue.slice(0, 4).map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/app/requests/${r.id}`}
                    className="hover:underline"
                  >
                    {r.title}
                  </Link>{" "}
                  <span className="text-xs text-red-600">due {r.dueDate}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </Widget>

        {/* Request Queue Summary */}
        <Widget title="Request queue">
          <div className="grid grid-cols-2 gap-2">
            {d.queue.map((q) => (
              <Link
                key={q.status}
                href={`/app/requests?status=${q.status}`}
                className="hover:bg-accent rounded-md border px-3 py-2"
              >
                <p className="text-muted-foreground text-xs capitalize">
                  {q.status.replace(/_/g, " ")}
                </p>
                <p className="font-semibold">{q.count}</p>
              </Link>
            ))}
          </div>
        </Widget>

        {/* Recent Comments */}
        <Widget title="Recent comments">
          {d.recentComments.length === 0 ? (
            <p className="text-muted-foreground text-xs">No recent comments.</p>
          ) : (
            <ul className="space-y-2">
              {d.recentComments.map((c, i) => (
                <li key={`${c.requestId}:${i}`} className="text-xs">
                  <Link
                    href={`/app/requests/${c.requestId}`}
                    className="font-medium hover:underline"
                  >
                    {c.requestTitle}
                  </Link>
                  {c.needsResponse ? (
                    <Badge variant="destructive" className="ml-1 text-[10px]">
                      Needs response
                    </Badge>
                  ) : null}
                  <p className="text-muted-foreground truncate">{c.body}</p>
                </li>
              ))}
            </ul>
          )}
        </Widget>

        {/* Deals Pipeline (read-only, per Phil's override) */}
        <Widget title="Deals pipeline">
          <p className="text-muted-foreground text-xs">
            Operations view of company deals. Read-only.
          </p>
          <div className="flex flex-wrap gap-1">
            {d.dealsPipeline.byStage.map((s) => (
              <Badge key={s.stage} variant="secondary" className="text-[10px]">
                {s.stage}: {s.count}
              </Badge>
            ))}
          </div>
          {d.dealsPipeline.upcoming.length > 0 ? (
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs font-medium">
                Upcoming closings
              </p>
              {d.dealsPipeline.upcoming.map((u) => (
                <Link
                  key={u.dealId}
                  href={`/app/deals/${u.dealId}`}
                  className="flex justify-between text-xs hover:underline"
                >
                  <span className="truncate">{u.property}</span>
                  <span className="text-muted-foreground">{u.closeDate}</span>
                </Link>
              ))}
            </div>
          ) : null}
        </Widget>

        {/* Training */}
        <Widget title="My training">
          <div className="flex justify-between text-xs">
            <span>
              {d.training.completed} of {d.training.total} modules
            </span>
            <span className="text-muted-foreground">{d.training.percent}%</span>
          </div>
          {d.training.nextModuleId ? (
            <Button asChild size="sm" variant="outline" className="w-full">
              <Link href={`/app/training/${d.training.nextModuleId}`}>
                Continue training
              </Link>
            </Button>
          ) : (
            <p className="text-muted-foreground text-xs">
              All modules complete.
            </p>
          )}
        </Widget>

        {/* Recent Messages */}
        <Widget title="Recent messages">
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
                    className="hover:bg-accent flex items-center justify-between gap-2 rounded px-1 py-0.5 text-xs"
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {t.name}
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

      <DashSection
        title="Recent activity"
        subtitle="Requests, training, and your own activity."
      >
        <ActivityFeed
          initial={feed}
          availableFilters={["all", "requests", "activity", "training"]}
        />
      </DashSection>
    </div>
  );
}
