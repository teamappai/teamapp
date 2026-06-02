"use client";

import { CreditCard, ExternalLink, Flag } from "lucide-react";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusChip } from "@/components/shared/status-chip";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { NotesPanel } from "@/components/admin/notes-panel";
import { AdminBillingActions } from "@/components/admin/admin-billing-actions";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { ROLE_LABELS } from "@/lib/constants/roles";
import { auditActionLabel } from "@/lib/audit/labels";
import { getPlan } from "@/lib/billing/plans";
import type { CompanyDetail } from "@/lib/admin/companies";
import type { AuditEntry } from "@/lib/admin/audit";

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {label}
      </p>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}

export function CompanyDetailTabs({
  detail,
  activity,
}: {
  detail: CompanyDetail;
  activity: AuditEntry[];
}) {
  const { company, users, deals, stageBreakdown, notes, flagOverrides } =
    detail;
  const plan = getPlan(company.plan);

  return (
    <Tabs defaultValue="overview">
      <TabsList className="flex-wrap">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="users">Users</TabsTrigger>
        <TabsTrigger value="billing">Billing</TabsTrigger>
        <TabsTrigger value="deals">Deals</TabsTrigger>
        <TabsTrigger value="activity">Activity</TabsTrigger>
        <TabsTrigger value="notes">Notes</TabsTrigger>
      </TabsList>

      {/* Overview */}
      <TabsContent value="overview">
        <Card>
          <CardContent className="grid grid-cols-2 gap-6 sm:grid-cols-3">
            <Stat
              label="Seats used"
              value={`${company.seatsUsed} / ${company.seats_total}`}
            />
            <Stat label="MRR" value={formatCurrency(company.mrrCents)} />
            <Stat
              label="Plan"
              value={`${plan.display_name} (${formatCurrency(plan.monthly_price_cents)}/mo)`}
            />
            <Stat
              label="Last active"
              value={
                company.lastActivityAt
                  ? formatDate(company.lastActivityAt, "relative")
                  : "—"
              }
            />
            <Stat
              label="Primary contact"
              value={
                detail.primaryContact ? (
                  <span>
                    {detail.primaryContact.full_name ?? "—"}
                    <span className="text-muted-foreground block text-xs font-normal">
                      {detail.primaryContact.email}
                    </span>
                  </span>
                ) : (
                  "—"
                )
              }
            />
            <Stat
              label="Feature flag overrides"
              value={
                flagOverrides.length ? (
                  <div className="flex flex-wrap gap-1">
                    {flagOverrides.map((f) => (
                      <span
                        key={f.key}
                        className="bg-muted inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-xs"
                      >
                        <Flag className="size-3" />
                        {f.key.replace(/^flag_/, "")}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-muted-foreground">None</span>
                )
              }
            />
          </CardContent>
        </Card>
      </TabsContent>

      {/* Users */}
      <TabsContent value="users">
        {users.length === 0 ? (
          <EmptyState title="No users in this company yet." />
        ) : (
          <Card className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="font-medium">{u.full_name ?? "—"}</div>
                      <div className="text-muted-foreground text-xs">
                        {u.email}
                      </div>
                    </TableCell>
                    <TableCell>{ROLE_LABELS[u.role]}</TableCell>
                    <TableCell>
                      <StatusChip domain="user" status={u.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {u.last_active_at
                        ? formatDate(u.last_active_at, "relative")
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </TabsContent>

      {/* Billing (Phase 12 — read-only Stripe mirror + super-admin overrides) */}
      <TabsContent value="billing">
        <Card>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
              <Stat label="Plan" value={plan.display_name} />
              <Stat
                label="Status"
                value={<StatusChip domain="company" status={company.status} />}
              />
              <Stat
                label="Billing cycle"
                value={
                  company.billing_cycle === "annual"
                    ? "Annual"
                    : company.billing_cycle === "monthly"
                      ? "Monthly"
                      : "—"
                }
              />
              <Stat
                label="Seats"
                value={`${company.seatsUsed} / ${company.seats_total}`}
              />
              <Stat
                label="Renews"
                value={
                  company.current_period_end
                    ? formatDate(company.current_period_end, "short")
                    : "—"
                }
              />
              <Stat
                label="Trial ends"
                value={
                  company.trial_ends_at
                    ? formatDate(company.trial_ends_at, "short")
                    : "—"
                }
              />
            </div>

            {company.stripe_customer_id ? (
              <Button asChild variant="outline">
                <a
                  href={`https://dashboard.stripe.com/customers/${company.stripe_customer_id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <CreditCard className="size-4" />
                  View in Stripe
                  <ExternalLink className="size-3.5" />
                </a>
              </Button>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-block">
                    <Button variant="outline" disabled>
                      <CreditCard className="size-4" />
                      View in Stripe
                      <ExternalLink className="size-3.5" />
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  No Stripe customer yet — created on first billing interaction.
                </TooltipContent>
              </Tooltip>
            )}

            <div className="space-y-2 border-t pt-4">
              <p className="text-sm font-medium">Super-admin actions</p>
              <AdminBillingActions companyId={company.id} />
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Deals (read-only) */}
      <TabsContent value="deals">
        {deals.length === 0 ? (
          <EmptyState title="No deals submitted yet." />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {stageBreakdown.map((s) => (
                <span
                  key={s.stage}
                  className="bg-muted inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
                >
                  {s.stage}
                  <span className="text-muted-foreground">{s.count}</span>
                </span>
              ))}
            </div>
            <Card className="py-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Property</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deals.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>{d.property_address ?? "—"}</TableCell>
                      <TableCell>
                        {[d.client_first_name, d.client_last_name]
                          .filter(Boolean)
                          .join(" ") || "—"}
                      </TableCell>
                      <TableCell>{d.stageName ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        {d.sales_price_cents != null
                          ? formatCurrency(d.sales_price_cents)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(d.created_at, "short")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>
        )}
      </TabsContent>

      {/* Activity (from audit_log) */}
      <TabsContent value="activity">
        {activity.length === 0 ? (
          <EmptyState title="No recorded admin activity for this company." />
        ) : (
          <ul className="space-y-2">
            {activity.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm"
              >
                <span>
                  <span className="font-medium">
                    {auditActionLabel(e.action)}
                  </span>
                  {e.actor.name ? (
                    <span className="text-muted-foreground">
                      {" "}
                      by {e.actor.name}
                    </span>
                  ) : null}
                </span>
                <span className="text-muted-foreground text-xs">
                  {formatDate(e.created_at, "relative")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </TabsContent>

      {/* Notes (super_admin only) */}
      <TabsContent value="notes">
        <NotesPanel companyId={company.id} notes={notes} />
      </TabsContent>
    </Tabs>
  );
}
