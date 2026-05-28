import type { Metadata } from "next";
import Link from "next/link";
import {
  Building2,
  Flag,
  Users as UsersIcon,
  AlertTriangle,
} from "lucide-react";

import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { getPlatformMetrics, ATTENTION_LABELS } from "@/lib/admin/metrics";
import { listAuditLog } from "@/lib/admin/audit";
import { auditActionLabel } from "@/lib/audit/labels";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils/format";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/admin/kpi-card";
import { Card, CardContent } from "@/components/ui/card";
import { StatusChip } from "@/components/shared/status-chip";
import { EmptyState } from "@/components/shared/empty-state";

export const metadata: Metadata = { title: "Platform admin · TeamApp" };

const QUICK_LINKS = [
  { href: "/app/admin/companies", label: "Companies", icon: Building2 },
  { href: "/app/admin/users", label: "Users", icon: UsersIcon },
  { href: "/app/admin/flags", label: "Feature Flags", icon: Flag },
];

export default async function AdminHomePage() {
  await requireSuperAdmin();

  const [metrics, recent] = await Promise.all([
    getPlatformMetrics(),
    listAuditLog({ limit: 20 }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform health"
        description="Cross-company operator view of the whole platform."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Companies"
          value={formatNumber(metrics.companies.total)}
          hint={
            <span>
              {metrics.companies.active} active · {metrics.companies.trialing}{" "}
              trialing · {metrics.companies.canceled} canceled
            </span>
          }
        />
        <KpiCard
          label="MRR"
          value={formatCurrency(metrics.mrrCents, { compact: true })}
          hint="Active subscriptions, monthly"
        />
        <KpiCard
          label="Active users (7d)"
          value={formatNumber(metrics.activeUsers7d)}
          hint="Signed in within 7 days"
        />
        <KpiCard
          label="New signups"
          value={formatNumber(metrics.newSignups7d)}
          hint={`${formatNumber(metrics.newSignups30d)} in last 30 days`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Customers needing attention */}
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="size-4 text-amber-500" />
            Customers needing attention
          </h2>
          {metrics.attention.length === 0 ? (
            <Card className="py-0">
              <CardContent className="text-muted-foreground p-4 text-sm">
                All customers look healthy.
              </CardContent>
            </Card>
          ) : (
            <ul className="space-y-2">
              {metrics.attention.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/app/admin/companies/${c.id}`}
                    className="hover:bg-muted/50 flex items-center justify-between gap-3 rounded-lg border p-3 text-sm transition-colors"
                  >
                    <span className="font-medium">{c.name}</span>
                    <span className="flex flex-wrap justify-end gap-1">
                      {c.reasons.map((r) => (
                        <StatusChip key={r} variant="warning" hideDot>
                          {ATTENTION_LABELS[r]}
                        </StatusChip>
                      ))}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <div className="grid grid-cols-3 gap-2 pt-2">
            {QUICK_LINKS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="hover:bg-muted/50 flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center text-sm font-medium transition-colors"
              >
                <Icon className="text-muted-foreground size-5" />
                {label}
              </Link>
            ))}
          </div>
        </section>

        {/* Recent admin actions */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Recent admin actions</h2>
          {recent.length === 0 ? (
            <EmptyState title="No admin actions recorded yet." />
          ) : (
            <ul className="divide-border divide-y rounded-lg border">
              {recent.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-3 p-3 text-sm"
                >
                  <span className="min-w-0">
                    <span className="font-medium">
                      {auditActionLabel(e.action)}
                    </span>
                    {e.actor.name ? (
                      <span className="text-muted-foreground truncate">
                        {" "}
                        · {e.actor.name}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {formatDate(e.created_at, "relative")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
