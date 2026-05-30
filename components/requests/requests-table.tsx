"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronDown, ChevronsUpDown } from "lucide-react";

import { formatDate } from "@/lib/utils/format";
import { ROLE_LABELS, type UserRole } from "@/lib/constants/roles";
import {
  PRIORITY_LABELS,
  PRIORITY_VARIANT,
  STATUS_FLOW,
  STATUS_LABELS,
  type RequestPriority,
  type RequestStatus,
} from "@/lib/requests/format";
import { TAB_LABELS, type RequestTab } from "@/lib/requests/access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { StatusChip } from "@/components/shared/status-chip";
import { UserAvatar } from "@/components/shared/user-avatar";
import { KpiCard } from "@/components/admin/kpi-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type RequestListItem = {
  id: string;
  title: string;
  typeId: string;
  typeName: string;
  category: string;
  typeRole: UserRole | null;
  status: RequestStatus;
  priority: RequestPriority;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeAvatar: string | null;
  assignedToRole: UserRole | null;
  unclaimed: boolean;
  creatorId: string | null;
  creatorName: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  mine: boolean;
  inMyQueue: boolean;
};

type Option = { id: string; name: string };

type Props = {
  items: RequestListItem[];
  role: UserRole;
  initialTab: RequestTab;
  tabs: RequestTab[];
  types: Option[];
  members: Option[];
};

const STATUS_OPTIONS: Option[] = (
  [...STATUS_FLOW, "rejected"] as RequestStatus[]
).map((s) => ({ id: s, name: STATUS_LABELS[s] }));

/** Multi-select filter rendered as a checkbox dropdown (shared with deals UX). */
function MultiSelectFilter({
  label,
  options,
  selected,
  onToggle,
  onClear,
}: {
  label: string;
  options: Option[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onClear: () => void;
}) {
  const count = selected.size;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="min-w-[10rem] justify-between font-normal"
        >
          <span className="truncate">
            {label}
            {count > 0 ? (
              <span className="text-muted-foreground"> · {count}</span>
            ) : null}
          </span>
          <ChevronDown className="size-4 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-[14rem]" align="start">
        <div className="flex items-center justify-between px-2 py-1">
          <DropdownMenuLabel className="px-0">{label}</DropdownMenuLabel>
          {count > 0 ? (
            <button
              type="button"
              onClick={onClear}
              className="text-muted-foreground hover:text-foreground text-xs"
            >
              Clear
            </button>
          ) : null}
        </div>
        <DropdownMenuSeparator />
        {options.length === 0 ? (
          <div className="text-muted-foreground px-2 py-2 text-sm">
            None available
          </div>
        ) : (
          options.map((o) => (
            <DropdownMenuCheckboxItem
              key={o.id}
              checked={selected.has(o.id)}
              onCheckedChange={() => onToggle(o.id)}
              onSelect={(e) => e.preventDefault()}
            >
              {o.name}
            </DropdownMenuCheckboxItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type SortKey = "title" | "type" | "status" | "assignee" | "due" | "created";

export function RequestsTable({
  items,
  role,
  initialTab,
  tabs,
  types,
  members,
}: Props) {
  const router = useRouter();

  const [tab, setTab] = React.useState<RequestTab>(initialTab);
  const [showAll, setShowAll] = React.useState(false);
  const [statusSel, setStatusSel] = React.useState<Set<string>>(new Set());
  const [typeSel, setTypeSel] = React.useState<Set<string>>(new Set());
  const [assigneeSel, setAssigneeSel] = React.useState<Set<string>>(new Set());
  const [creatorSel, setCreatorSel] = React.useState<Set<string>>(new Set());
  const [dueFrom, setDueFrom] = React.useState("");
  const [dueTo, setDueTo] = React.useState("");
  const [createdFrom, setCreatedFrom] = React.useState("");
  const [createdTo, setCreatedTo] = React.useState("");
  const [sortKey, setSortKey] = React.useState<SortKey>("created");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");

  // Marketing / Admin-TC land filtered to their own request-type domain
  // (F-132/F-133); "Show all" opts out.
  const roleDefaultType: UserRole | null =
    role === "marketing"
      ? "marketing"
      : role === "admin_tc"
        ? "admin_tc"
        : null;

  const toggle =
    (setter: React.Dispatch<React.SetStateAction<Set<string>>>) =>
    (id: string) =>
      setter((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });

  const onTabChange = (value: string) => {
    setTab(value as RequestTab);
    router.replace(`/app/requests?tab=${value}`, { scroll: false });
  };

  // Rows in the current tab, then the role-default type scope.
  const tabRows = React.useMemo(() => {
    const base = items.filter((r) =>
      tab === "my-queue"
        ? r.inMyQueue
        : tab === "team-queue"
          ? !r.inMyQueue
          : r.mine,
    );
    if (roleDefaultType && !showAll) {
      return base.filter((r) => r.typeRole === roleDefaultType);
    }
    return base;
  }, [items, tab, roleDefaultType, showAll]);

  // KPIs are computed over the tab's set (stable under the explicit filters).
  const kpis = React.useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    let open = 0;
    let inProgress = 0;
    let review = 0;
    let completed = 0;
    for (const r of tabRows) {
      if (r.status === "pending") open++;
      else if (r.status === "in_progress") inProgress++;
      else if (r.status === "ready_for_review") review++;
      else if (
        r.status === "completed" &&
        new Date(r.updatedAt).getTime() >= weekAgo
      ) {
        completed++;
      }
    }
    return { open, inProgress, review, completed };
  }, [tabRows]);

  const filtered = React.useMemo(() => {
    const dFrom = dueFrom ? new Date(dueFrom).getTime() : null;
    const dTo = dueTo ? new Date(dueTo).getTime() + 86_399_000 : null;
    const cFrom = createdFrom ? new Date(createdFrom).getTime() : null;
    const cTo = createdTo ? new Date(createdTo).getTime() + 86_399_000 : null;
    const rows = tabRows.filter((r) => {
      if (statusSel.size > 0 && !statusSel.has(r.status)) return false;
      if (typeSel.size > 0 && !typeSel.has(r.typeId)) return false;
      if (
        assigneeSel.size > 0 &&
        (!r.assigneeId || !assigneeSel.has(r.assigneeId))
      )
        return false;
      if (creatorSel.size > 0 && (!r.creatorId || !creatorSel.has(r.creatorId)))
        return false;
      if (dFrom || dTo) {
        if (!r.dueDate) return false;
        const t = new Date(r.dueDate).getTime();
        if (dFrom && t < dFrom) return false;
        if (dTo && t > dTo) return false;
      }
      if (cFrom || cTo) {
        const t = new Date(r.createdAt).getTime();
        if (cFrom && t < cFrom) return false;
        if (cTo && t > cTo) return false;
      }
      return true;
    });

    const dir = sortDir === "asc" ? 1 : -1;
    const val = (r: RequestListItem): string | number => {
      switch (sortKey) {
        case "title":
          return r.title.toLowerCase();
        case "type":
          return r.typeName.toLowerCase();
        case "status":
          return STATUS_FLOW.indexOf(r.status as RequestStatus);
        case "assignee":
          return (r.assigneeName ?? r.assignedToRole ?? "~").toLowerCase();
        case "due":
          return r.dueDate ? new Date(r.dueDate).getTime() : Infinity;
        case "created":
        default:
          return new Date(r.createdAt).getTime();
      }
    };
    return [...rows].sort((a, b) => {
      const av = val(a);
      const bv = val(b);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [
    tabRows,
    statusSel,
    typeSel,
    assigneeSel,
    creatorSel,
    dueFrom,
    dueTo,
    createdFrom,
    createdTo,
    sortKey,
    sortDir,
  ]);

  const resetAll = () => {
    setStatusSel(new Set());
    setTypeSel(new Set());
    setAssigneeSel(new Set());
    setCreatorSel(new Set());
    setDueFrom("");
    setDueTo("");
    setCreatedFrom("");
    setCreatedTo("");
  };

  const onSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "title" || key === "type" ? "asc" : "desc");
    }
  };

  const SortHead = ({
    label,
    sortKey: key,
    className,
  }: {
    label: string;
    sortKey: SortKey;
    className?: string;
  }) => (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(key)}
        className="hover:text-foreground -mx-1 inline-flex items-center gap-1 px-1"
      >
        {label}
        {sortKey === key ? (
          sortDir === "asc" ? (
            <ArrowUp className="size-3.5" />
          ) : (
            <ArrowDown className="size-3.5" />
          )
        ) : (
          <ChevronsUpDown className="size-3.5 opacity-40" />
        )}
      </button>
    </TableHead>
  );

  return (
    <div className="space-y-5">
      <Tabs value={tab} onValueChange={onTabChange}>
        <TabsList>
          {tabs.map((t) => (
            <TabsTrigger key={t} value={t}>
              {TAB_LABELS[t]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* KPIs — every card renders a number, even 0 (F-123/F-134) */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Open"
          value={String(kpis.open)}
          hint="Awaiting pickup"
        />
        <KpiCard label="In progress" value={String(kpis.inProgress)} />
        <KpiCard
          label="Ready for review"
          value={String(kpis.review)}
          hint="Needs your review"
        />
        <KpiCard label="Completed (7 days)" value={String(kpis.completed)} />
      </div>

      {/* Filters — identical across tabs (F-135) */}
      <div className="flex flex-wrap items-end gap-3">
        <MultiSelectFilter
          label="Status"
          options={STATUS_OPTIONS}
          selected={statusSel}
          onToggle={toggle(setStatusSel)}
          onClear={() => setStatusSel(new Set())}
        />
        <MultiSelectFilter
          label="Type"
          options={types}
          selected={typeSel}
          onToggle={toggle(setTypeSel)}
          onClear={() => setTypeSel(new Set())}
        />
        <MultiSelectFilter
          label="Assigned to"
          options={members}
          selected={assigneeSel}
          onToggle={toggle(setAssigneeSel)}
          onClear={() => setAssigneeSel(new Set())}
        />
        <MultiSelectFilter
          label="Assigned by"
          options={members}
          selected={creatorSel}
          onToggle={toggle(setCreatorSel)}
          onClear={() => setCreatorSel(new Set())}
        />
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="due-from" className="text-xs">
              Due from
            </Label>
            <Input
              id="due-from"
              type="date"
              value={dueFrom}
              onChange={(e) => setDueFrom(e.target.value)}
              className="w-[9.5rem]"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="due-to" className="text-xs">
              Due to
            </Label>
            <Input
              id="due-to"
              type="date"
              value={dueTo}
              onChange={(e) => setDueTo(e.target.value)}
              className="w-[9.5rem]"
            />
          </div>
        </div>
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="created-from" className="text-xs">
              Created from
            </Label>
            <Input
              id="created-from"
              type="date"
              value={createdFrom}
              onChange={(e) => setCreatedFrom(e.target.value)}
              className="w-[9.5rem]"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="created-to" className="text-xs">
              Created to
            </Label>
            <Input
              id="created-to"
              type="date"
              value={createdTo}
              onChange={(e) => setCreatedTo(e.target.value)}
              className="w-[9.5rem]"
            />
          </div>
        </div>
        <Button variant="ghost" onClick={resetAll} className="text-sm">
          Reset
        </Button>
        {roleDefaultType ? (
          <div className="flex items-center gap-2 pb-1">
            <Switch
              id="show-all"
              checked={showAll}
              onCheckedChange={setShowAll}
            />
            <Label htmlFor="show-all" className="text-sm">
              Show all
            </Label>
          </div>
        ) : null}
      </div>

      <p className="text-muted-foreground text-sm">
        {filtered.length} {filtered.length === 1 ? "request" : "requests"}
      </p>

      <div className="max-h-[70vh] overflow-auto rounded-md border">
        <Table>
          <TableHeader className="bg-background sticky top-0 z-10">
            <TableRow>
              <SortHead label="Title" sortKey="title" />
              <SortHead label="Type" sortKey="type" />
              <SortHead label="Status" sortKey="status" />
              <SortHead label="Assigned to" sortKey="assignee" />
              <SortHead label="Due date" sortKey="due" />
              <SortHead label="Created" sortKey="created" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-40 p-0">
                  <EmptyState
                    title="No requests here"
                    description="Try a different tab, or widen your filters."
                  />
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow
                  key={r.id}
                  onClick={() => router.push(`/app/requests/${r.id}`)}
                  className="cursor-pointer"
                >
                  <TableCell className="max-w-[20rem]">
                    <div className="flex items-center gap-2">
                      {r.priority === "urgent" || r.priority === "high" ? (
                        <StatusChip
                          variant={PRIORITY_VARIANT[r.priority]}
                          hideDot
                          className="shrink-0"
                        >
                          {PRIORITY_LABELS[r.priority]}
                        </StatusChip>
                      ) : null}
                      <span className="block truncate font-medium">
                        {r.title}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {r.typeName}
                  </TableCell>
                  <TableCell>
                    <StatusChip domain="request" status={r.status} />
                  </TableCell>
                  <TableCell>
                    {r.assigneeId ? (
                      <div className="flex items-center gap-2">
                        <UserAvatar
                          size="sm"
                          name={r.assigneeName}
                          src={r.assigneeAvatar}
                          seed={r.assigneeId}
                        />
                        <span className="whitespace-nowrap">
                          {r.assigneeName ?? "Unnamed"}
                        </span>
                      </div>
                    ) : r.assignedToRole ? (
                      <span className="text-muted-foreground whitespace-nowrap">
                        {ROLE_LABELS[r.assignedToRole]} queue
                        {r.unclaimed ? " · unclaimed" : ""}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {r.dueDate ? formatDate(r.dueDate, "short") : "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(r.createdAt, "short")}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
