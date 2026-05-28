import type { Metadata } from "next";

import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { listAuditLog, getAuditFilterOptions } from "@/lib/admin/audit";
import { auditActionLabel } from "@/lib/audit/labels";
import { humanizeStatus } from "@/lib/constants/status";
import { ROLE_LABELS } from "@/lib/constants/roles";
import { formatDate } from "@/lib/utils/format";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FilterChip } from "@/components/admin/table-filters";

export const metadata: Metadata = { title: "Audit log · TeamApp" };

const BASE = "/app/admin/audit";

type SearchParams = {
  actor?: string;
  action?: string;
  resource?: string;
  from?: string;
  to?: string;
};

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireSuperAdmin();
  const sp = await searchParams;

  const [entries, options] = await Promise.all([
    listAuditLog({
      actor: sp.actor,
      action: sp.action,
      resourceType: sp.resource,
      from: sp.from,
      to: sp.to,
    }),
    getAuditFilterOptions(),
  ]);

  const current = {
    actor: sp.actor,
    action: sp.action,
    resource: sp.resource,
    from: sp.from,
    to: sp.to,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit log"
        description="Every sensitive platform action, newest first."
      />

      {/* Actor + date-range filter (GET form). */}
      <Card className="py-0">
        <form
          action={BASE}
          method="get"
          className="flex flex-wrap items-end gap-3 p-4"
        >
          {sp.action ? (
            <input type="hidden" name="action" value={sp.action} />
          ) : null}
          {sp.resource ? (
            <input type="hidden" name="resource" value={sp.resource} />
          ) : null}
          <div className="space-y-1">
            <Label htmlFor="actor" className="text-xs">
              Actor
            </Label>
            <Input
              id="actor"
              name="actor"
              defaultValue={sp.actor}
              placeholder="Name or email"
              className="w-56"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="from" className="text-xs">
              From
            </Label>
            <Input id="from" name="from" type="date" defaultValue={sp.from} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="to" className="text-xs">
              To
            </Label>
            <Input id="to" name="to" type="date" defaultValue={sp.to} />
          </div>
          <Button type="submit" variant="secondary">
            Apply
          </Button>
          {sp.actor || sp.from || sp.to || sp.action || sp.resource ? (
            <Button asChild variant="ghost">
              <a href={BASE}>Clear</a>
            </Button>
          ) : null}
        </form>
      </Card>

      {/* Action + resource chips */}
      {options.actions.length ? (
        <div className="flex flex-wrap gap-2">
          <span className="text-muted-foreground self-center text-xs font-medium">
            Action:
          </span>
          <FilterChip
            label="All"
            paramKey="action"
            basePath={BASE}
            current={current}
          />
          {options.actions.map((a) => (
            <FilterChip
              key={a}
              label={auditActionLabel(a)}
              paramKey="action"
              value={a}
              basePath={BASE}
              current={current}
            />
          ))}
        </div>
      ) : null}

      {options.resourceTypes.length ? (
        <div className="flex flex-wrap gap-2">
          <span className="text-muted-foreground self-center text-xs font-medium">
            Resource:
          </span>
          <FilterChip
            label="All"
            paramKey="resource"
            basePath={BASE}
            current={current}
          />
          {options.resourceTypes.map((r) => (
            <FilterChip
              key={r}
              label={humanizeStatus(r)}
              paramKey="resource"
              value={r}
              basePath={BASE}
              current={current}
            />
          ))}
        </div>
      ) : null}

      {entries.length === 0 ? (
        <EmptyState
          title="No audit entries"
          description="No actions match the current filters."
        />
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-muted-foreground">
                    <div>{formatDate(e.created_at, "short")}</div>
                    <div className="text-xs">
                      {formatDate(e.created_at, "relative")}
                    </div>
                  </TableCell>
                  <TableCell>
                    {e.actor.name || e.actor.email ? (
                      <div>
                        <div className="font-medium">
                          {e.actor.name ?? e.actor.email}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {e.actor.email}
                          {e.actor.role
                            ? ` · ${ROLE_LABELS[e.actor.role]}`
                            : ""}
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">System</span>
                    )}
                  </TableCell>
                  <TableCell>{auditActionLabel(e.action)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {e.resource_type ? humanizeStatus(e.resource_type) : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {e.ip_address ?? "—"}
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
