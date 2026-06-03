import Link from "next/link";

import { getMarketingDashboard } from "@/lib/dashboards/marketing";
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

export async function MarketingDashboard({
  userId,
  companyId,
  role,
}: {
  userId: string;
  companyId: string;
  role: Database["public"]["Enums"]["user_role"];
}) {
  const [d, users] = await Promise.all([
    getMarketingDashboard({ userId, companyId, role }),
    fetchCompanyUsers(companyId),
  ]);
  const userMap = new Map<string, DashUser>(users.map((u) => [u.id, u]));
  // The RPC already filters marketing to marketing-typed request events + own
  // activity — never deal events (F-133). Deals filter is also hidden in the UI.
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
          { label: "View my queue", href: "/app/requests", primary: true },
          { label: "View training", href: "/app/training" },
          { label: "Go to messages", href: "/app/messages" },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Today's Focus */}
        <Widget title="Today's focus">
          <div className="text-muted-foreground flex flex-wrap gap-x-6 gap-y-1">
            <span>
              <span className="text-foreground font-semibold">
                {d.todaysFocus.assigned.length}
              </span>{" "}
              assigned to me
            </span>
            <span>
              <span className="text-foreground font-semibold">
                {d.todaysFocus.overdue}
              </span>{" "}
              overdue
            </span>
            <span>
              <span className="text-foreground font-semibold">
                {d.todaysFocus.recentlyCompleted}
              </span>{" "}
              completed
            </span>
          </div>
          {d.todaysFocus.assigned.length > 0 ? (
            <ul className="space-y-1">
              {d.todaysFocus.assigned.map((r) => (
                <li key={r.id} className="flex items-center gap-2">
                  <Link
                    href={`/app/requests/${r.id}`}
                    className="hover:underline"
                  >
                    {r.title}
                  </Link>
                  {r.priority === "urgent" || r.priority === "high" ? (
                    <Badge variant="destructive" className="text-[10px]">
                      {r.priority}
                    </Badge>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-xs">
              Nothing assigned right now.
            </p>
          )}
        </Widget>

        {/* Queue by Type */}
        <Widget title="Request queue by type">
          {d.queueByType.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              No open marketing requests.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {d.queueByType.map((q) => (
                <Link
                  key={q.type}
                  href={`/app/requests?type=${encodeURIComponent(q.type)}`}
                  className="hover:bg-accent rounded-md border px-3 py-2"
                >
                  <p className="text-muted-foreground text-xs">{q.type}</p>
                  <p className="font-semibold">{q.count}</p>
                </Link>
              ))}
            </div>
          )}
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
        subtitle="Marketing requests, training, and your own activity only."
      >
        <ActivityFeed
          initial={feed}
          availableFilters={["all", "requests", "training", "activity"]}
        />
      </DashSection>
    </div>
  );
}
