"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Link2 } from "lucide-react";

import { formatCurrency, formatDate } from "@/lib/utils/format";
import { clientInitials, clientName } from "@/lib/deals/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusChip } from "@/components/shared/status-chip";
import { UserAvatar } from "@/components/shared/user-avatar";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type DealListItem = {
  id: string;
  displayId: string;
  propertyAddress: string | null;
  propertyCity: string | null;
  propertyState: string | null;
  propertyZip: string | null;
  clientFirstName: string | null;
  clientLastName: string | null;
  agentName: string | null;
  agentAvatar: string | null;
  agentSeed: string | null;
  stageId: string | null;
  stageName: string | null;
  stageStatus: string;
  representing: "buyer" | "seller" | "dual" | null;
  dealTypeId: string | null;
  salesPriceCents: number | null;
  gciCents: number | null;
  closeDate: string | null;
  createdAt: string;
  companyName: string | null;
  shareLinkEnabled: boolean;
  agentIds: string[];
};

type Option = { id: string; name: string };

type Props = {
  items: DealListItem[];
  stages: Option[];
  /** Default stage selection = all non-terminal stages (per spec). */
  nonTerminalStageIds: string[];
  dealTypes: Option[];
  agents: Option[];
  showCompany: boolean;
};

/**
 * Multi-select filter rendered as a checkbox dropdown. Generous min-width so
 * labels never truncate (audit F-028).
 */
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
          className="w-full justify-between font-normal sm:w-auto sm:min-w-[11rem]"
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
      <DropdownMenuContent className="min-w-[16rem]" align="start">
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

const DEAL_TYPE_KIND: Option[] = [
  { id: "buyer", name: "Buyer" },
  { id: "seller", name: "Seller" },
  { id: "dual", name: "Dual" },
];

export function DealsTable({
  items,
  stages,
  nonTerminalStageIds,
  dealTypes,
  agents,
  showCompany,
}: Props) {
  const router = useRouter();

  // Stage defaults to all non-terminal stages (never an "All Statuses" sentinel
  // stored as data — these are real stage ids).
  const [stageSel, setStageSel] = React.useState<Set<string>>(
    () => new Set(nonTerminalStageIds),
  );
  const [agentSel, setAgentSel] = React.useState<Set<string>>(new Set());
  const [typeSel, setTypeSel] = React.useState<Set<string>>(new Set());
  const [repSel, setRepSel] = React.useState<Set<string>>(new Set());
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");

  const toggle =
    (setter: React.Dispatch<React.SetStateAction<Set<string>>>) =>
    (id: string) =>
      setter((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });

  const filtered = React.useMemo(() => {
    const fromTime = from ? new Date(from).getTime() : null;
    const toTime = to ? new Date(to).getTime() + 86_399_000 : null; // inclusive end-of-day
    return items.filter((d) => {
      if (stageSel.size > 0 && (!d.stageId || !stageSel.has(d.stageId)))
        return false;
      if (agentSel.size > 0 && !d.agentIds.some((a) => agentSel.has(a)))
        return false;
      if (typeSel.size > 0 && (!d.dealTypeId || !typeSel.has(d.dealTypeId)))
        return false;
      if (repSel.size > 0 && (!d.representing || !repSel.has(d.representing)))
        return false;
      if (fromTime || toTime) {
        const t = new Date(d.createdAt).getTime();
        if (fromTime && t < fromTime) return false;
        if (toTime && t > toTime) return false;
      }
      return true;
    });
  }, [items, stageSel, agentSel, typeSel, repSel, from, to]);

  const resetAll = () => {
    setStageSel(new Set(nonTerminalStageIds));
    setAgentSel(new Set());
    setTypeSel(new Set());
    setRepSel(new Set());
    setFrom("");
    setTo("");
  };

  return (
    <div className="space-y-4">
      {/* Filter row */}
      <div className="grid grid-cols-1 items-end gap-3 sm:flex sm:flex-wrap">
        <MultiSelectFilter
          label="Stage"
          options={stages}
          selected={stageSel}
          onToggle={toggle(setStageSel)}
          onClear={() => setStageSel(new Set())}
        />
        <MultiSelectFilter
          label="Agent"
          options={agents}
          selected={agentSel}
          onToggle={toggle(setAgentSel)}
          onClear={() => setAgentSel(new Set())}
        />
        {dealTypes.length > 0 ? (
          <MultiSelectFilter
            label="Deal type"
            options={dealTypes}
            selected={typeSel}
            onToggle={toggle(setTypeSel)}
            onClear={() => setTypeSel(new Set())}
          />
        ) : null}
        <MultiSelectFilter
          label="Representing"
          options={DEAL_TYPE_KIND}
          selected={repSel}
          onToggle={toggle(setRepSel)}
          onClear={() => setRepSel(new Set())}
        />
        <div className="flex w-full items-end gap-2 sm:w-auto">
          <div className="flex-1 space-y-1 sm:flex-none">
            <Label htmlFor="deal-from" className="text-xs">
              From
            </Label>
            <Input
              id="deal-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full sm:w-[10rem]"
            />
          </div>
          <div className="flex-1 space-y-1 sm:flex-none">
            <Label htmlFor="deal-to" className="text-xs">
              To
            </Label>
            <Input
              id="deal-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full sm:w-[10rem]"
            />
          </div>
        </div>
        <Button variant="ghost" onClick={resetAll} className="text-sm">
          Reset
        </Button>
      </div>

      <p className="text-muted-foreground text-sm">
        {filtered.length} {filtered.length === 1 ? "deal" : "deals"}
      </p>

      {/* Mobile card list (≤768px) — the table is unreadable on phones. */}
      <div className="space-y-2 md:hidden">
        {filtered.length === 0 ? (
          <div className="rounded-md border">
            <EmptyState
              title="No deals match these filters"
              description="Try widening the stage or date filters."
            />
          </div>
        ) : (
          filtered.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => router.push(`/app/deals/${d.id}`)}
              className="hover:bg-muted/50 focus-visible:ring-ring/50 block w-full rounded-md border p-3 text-left focus-visible:ring-2 focus-visible:outline-none"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="block truncate font-medium">
                    {d.propertyAddress ?? "—"}
                  </span>
                  {d.propertyCity ? (
                    <span className="text-muted-foreground block truncate text-xs">
                      {[d.propertyCity, d.propertyState]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  ) : null}
                </div>
                {d.stageName ? (
                  <StatusChip
                    domain="deal"
                    status={d.stageStatus}
                    className="shrink-0"
                  >
                    {d.stageName}
                  </StatusChip>
                ) : null}
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <UserAvatar
                    size="sm"
                    name={d.agentName}
                    src={d.agentAvatar}
                    seed={d.agentSeed}
                  />
                  <span className="text-muted-foreground truncate text-xs">
                    {d.agentName ?? "Unassigned"}
                  </span>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums">
                  {d.salesPriceCents != null
                    ? formatCurrency(d.salesPriceCents)
                    : "—"}
                </span>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Table (≥768px) */}
      <div className="hidden rounded-md border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Deal ID</TableHead>
              <TableHead>Property</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Agent</TableHead>
              {showCompany ? <TableHead>Company</TableHead> : null}
              <TableHead>Stage</TableHead>
              <TableHead className="text-right">Sales price</TableHead>
              <TableHead className="text-right">GCI</TableHead>
              <TableHead>Close date</TableHead>
              <TableHead className="text-center">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-default">Shared w/ client</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    Public link enabled for this deal
                  </TooltipContent>
                </Tooltip>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showCompany ? 10 : 9} className="h-40 p-0">
                  <EmptyState
                    title="No deals match these filters"
                    description="Try widening the stage or date filters."
                  />
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((d) => (
                <TableRow
                  key={d.id}
                  onClick={() => router.push(`/app/deals/${d.id}`)}
                  className="cursor-pointer"
                >
                  <TableCell className="font-mono text-xs whitespace-nowrap">
                    {d.displayId}
                  </TableCell>
                  <TableCell className="max-w-[16rem]">
                    {/* break-words (not break-all) so multi-word names like
                        "HomeReady Team" never split mid-word (audit F-030). */}
                    <span className="block truncate break-words">
                      {d.propertyAddress ?? "—"}
                    </span>
                    {d.propertyCity ? (
                      <span className="text-muted-foreground block truncate text-xs">
                        {[d.propertyCity, d.propertyState]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="bg-muted flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                        {clientInitials(d.clientFirstName, d.clientLastName)}
                      </span>
                      <span className="whitespace-nowrap">
                        {clientName(d.clientFirstName, d.clientLastName)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <UserAvatar
                        size="sm"
                        name={d.agentName}
                        src={d.agentAvatar}
                        seed={d.agentSeed}
                      />
                      <span className="whitespace-nowrap">
                        {d.agentName ?? "Unassigned"}
                      </span>
                    </div>
                  </TableCell>
                  {showCompany ? (
                    <TableCell>
                      {d.companyName ? (
                        <StatusChip variant="neutral" hideDot>
                          {d.companyName}
                        </StatusChip>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  ) : null}
                  <TableCell>
                    {d.stageName ? (
                      <StatusChip domain="deal" status={d.stageStatus}>
                        {d.stageName}
                      </StatusChip>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {d.salesPriceCents != null
                      ? formatCurrency(d.salesPriceCents)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {d.gciCents != null ? formatCurrency(d.gciCents) : "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {d.closeDate ? formatDate(d.closeDate, "short") : "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    {d.shareLinkEnabled ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex justify-center text-emerald-600">
                            <Link2
                              className="size-4"
                              aria-label="Public link enabled"
                            />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          Public link enabled for this deal
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
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
