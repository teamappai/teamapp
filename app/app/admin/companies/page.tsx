import type { Metadata } from "next";
import Link from "next/link";
import { Building2 } from "lucide-react";

import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { getCompanyRows, type CompanyRow } from "@/lib/admin/companies";
import { getPlan } from "@/lib/billing/plans";
import { PLAN_ORDER } from "@/lib/billing/plans";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { humanizeStatus } from "@/lib/constants/status";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { StatusChip } from "@/components/shared/status-chip";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SortableHeader, FilterChip } from "@/components/admin/table-filters";
import { SearchBox } from "@/components/admin/search-box";
import { CompanyRowActions } from "@/components/admin/company-row-actions";

export const metadata: Metadata = { title: "Companies · TeamApp" };

const BASE = "/app/admin/companies";
const STATUSES = [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "paused",
] as const;

type SearchParams = {
  sort?: string;
  dir?: string;
  plan?: string;
  status?: string;
  q?: string;
};

function sortRows(rows: CompanyRow[], sort: string, dir: string): CompanyRow[] {
  const mult = dir === "asc" ? 1 : -1;
  const value = (c: CompanyRow): string | number => {
    switch (sort) {
      case "company":
        return c.name.toLowerCase();
      case "plan":
        return c.plan;
      case "status":
        return c.status;
      case "seats":
        return c.seatsUsed;
      case "lastActivity":
        return c.lastActivityAt ?? "";
      case "created":
        return c.created_at;
      case "mrr":
      default:
        return c.mrrCents;
    }
  };
  return [...rows].sort((a, b) => {
    const av = value(a);
    const bv = value(b);
    if (av < bv) return -1 * mult;
    if (av > bv) return 1 * mult;
    return 0;
  });
}

export default async function AdminCompaniesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireSuperAdmin();
  const sp = await searchParams;
  const sort = sp.sort ?? "mrr";
  const dir = sp.dir ?? "desc";

  let rows = await getCompanyRows();
  if (sp.plan) rows = rows.filter((c) => c.plan === sp.plan);
  if (sp.status) rows = rows.filter((c) => c.status === sp.status);
  if (sp.q?.trim()) {
    const term = sp.q.trim().toLowerCase();
    rows = rows.filter((c) => c.name.toLowerCase().includes(term));
  }
  rows = sortRows(rows, sort, dir);

  const current = {
    sort: sp.sort,
    dir: sp.dir,
    plan: sp.plan,
    status: sp.status,
    q: sp.q,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Companies"
        description="Every customer on the platform."
      />

      <div className="flex flex-col gap-3">
        <SearchBox
          name="q"
          placeholder="Search companies…"
          defaultValue={sp.q}
          basePath={BASE}
          hidden={{
            sort: sp.sort,
            dir: sp.dir,
            plan: sp.plan,
            status: sp.status,
          }}
        />
        <div className="flex flex-wrap gap-2">
          <span className="text-muted-foreground self-center text-xs font-medium">
            Plan:
          </span>
          <FilterChip
            label="All"
            paramKey="plan"
            basePath={BASE}
            current={current}
          />
          {PLAN_ORDER.map((p) => (
            <FilterChip
              key={p}
              label={getPlan(p).display_name}
              paramKey="plan"
              value={p}
              basePath={BASE}
              current={current}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="text-muted-foreground self-center text-xs font-medium">
            Status:
          </span>
          <FilterChip
            label="All"
            paramKey="status"
            basePath={BASE}
            current={current}
          />
          {STATUSES.map((s) => (
            <FilterChip
              key={s}
              label={humanizeStatus(s)}
              paramKey="status"
              value={s}
              basePath={BASE}
              current={current}
            />
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No companies yet — invite your first customer."
          description={
            sp.q || sp.plan || sp.status
              ? "No companies match the current filters."
              : undefined
          }
        />
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortableHeader
                    column="company"
                    label="Company"
                    basePath={BASE}
                    current={current}
                  />
                </TableHead>
                <TableHead>
                  <SortableHeader
                    column="plan"
                    label="Plan"
                    basePath={BASE}
                    current={current}
                  />
                </TableHead>
                <TableHead>
                  <SortableHeader
                    column="status"
                    label="Status"
                    basePath={BASE}
                    current={current}
                  />
                </TableHead>
                <TableHead>
                  <SortableHeader
                    column="seats"
                    label="Seats"
                    basePath={BASE}
                    current={current}
                  />
                </TableHead>
                <TableHead className="text-right">
                  <SortableHeader
                    column="mrr"
                    label="MRR"
                    basePath={BASE}
                    current={current}
                    className="justify-end"
                  />
                </TableHead>
                <TableHead>
                  <SortableHeader
                    column="lastActivity"
                    label="Last activity"
                    basePath={BASE}
                    current={current}
                  />
                </TableHead>
                <TableHead>
                  <SortableHeader
                    column="created"
                    label="Created"
                    basePath={BASE}
                    current={current}
                  />
                </TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link
                      href={`${BASE}/${c.id}`}
                      className="font-medium hover:underline"
                    >
                      {c.name}
                    </Link>
                  </TableCell>
                  <TableCell>{getPlan(c.plan).display_name}</TableCell>
                  <TableCell>
                    <StatusChip domain="company" status={c.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.seatsUsed} / {c.seats_total}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(c.mrrCents)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.lastActivityAt
                      ? formatDate(c.lastActivityAt, "relative")
                      : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(c.created_at, "short")}
                  </TableCell>
                  <TableCell>
                    <CompanyRowActions
                      companyId={c.id}
                      companyName={c.name}
                      status={c.status}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
