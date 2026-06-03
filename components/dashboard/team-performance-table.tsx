"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, MoreHorizontal } from "lucide-react";

import type { TeamPerfRow } from "@/lib/dashboards/team-lead";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { formatGoalValue } from "@/lib/coaching/goals";
import { UserAvatar } from "@/components/shared/user-avatar";
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
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { CoachingNoteDialog } from "@/components/coaching/coaching-note-dialog";
import { NudgeDialog } from "@/components/coaching/nudge-dialog";
import { cn } from "@/lib/utils/index";

type SortKey =
  | "name"
  | "goal"
  | "onboarding"
  | "lastActivity"
  | "closedDeals"
  | "closedVolume"
  | "gci";

const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: "name", label: "Agent", numeric: false },
  { key: "goal", label: "Goal", numeric: true },
  { key: "onboarding", label: "Onboarding", numeric: true },
  { key: "lastActivity", label: "Last activity", numeric: true },
  { key: "closedDeals", label: "Closed deals YTD", numeric: true },
  { key: "closedVolume", label: "Closed volume YTD", numeric: true },
  { key: "gci", label: "GCI YTD", numeric: true },
];

function sortValue(r: TeamPerfRow, key: SortKey): number | string {
  switch (key) {
    case "name":
      return r.name?.toLowerCase() ?? "";
    case "goal":
      return r.goalPct ?? -1;
    case "onboarding":
      return r.onboardingPct;
    case "lastActivity":
      return r.lastActivity ?? "";
    case "closedDeals":
      return r.closedDealsYtd;
    case "closedVolume":
      return r.closedVolumeYtdCents;
    case "gci":
      return r.gciYtdCents;
  }
}

export function TeamPerformanceTable({ rows }: { rows: TeamPerfRow[] }) {
  const router = useRouter();
  const [sortKey, setSortKey] = React.useState<SortKey>("gci");
  const [dir, setDir] = React.useState<"asc" | "desc">("desc");
  const [noteAgent, setNoteAgent] = React.useState<{
    id: string;
    name: string;
  } | null>(null);
  const [nudgeAgent, setNudgeAgent] = React.useState<{
    id: string;
    name: string;
  } | null>(null);

  const sorted = React.useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      if (av < bv) return dir === "asc" ? -1 : 1;
      if (av > bv) return dir === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [rows, sortKey, dir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setDir(key === "name" ? "asc" : "desc");
    }
  }

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground rounded-md border py-8 text-center text-sm">
        No agents on your team yet.
      </p>
    );
  }

  return (
    <>
      {/* Mobile card list (≤768px) */}
      <div className="space-y-2 md:hidden">
        {sorted.map((r) => (
          <button
            key={r.userId}
            type="button"
            onClick={() => router.push(`/app/users/${r.userId}`)}
            className="hover:bg-muted/50 focus-visible:ring-ring/50 block w-full rounded-md border p-3 text-left focus-visible:ring-2 focus-visible:outline-none"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <UserAvatar
                  name={r.name}
                  src={r.avatarUrl}
                  seed={r.userId}
                  size="sm"
                />
                <span className="truncate font-medium">{r.name ?? "—"}</span>
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums">
                {formatCurrency(r.gciYtdCents, { compact: true })}
              </span>
            </div>
            <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs tabular-nums">
              <span>{r.closedDealsYtd} closed YTD</span>
              <span>
                {formatCurrency(r.closedVolumeYtdCents, { compact: true })} vol
              </span>
              <span>
                {r.lastActivity
                  ? formatDate(r.lastActivity, "relative")
                  : "No activity"}
              </span>
              {r.goalPct !== null ? <span>{r.goalPct}% of goal</span> : null}
            </div>
          </button>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-md border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              {COLUMNS.map((c) => (
                <TableHead
                  key={c.key}
                  className={cn(
                    "cursor-pointer whitespace-nowrap select-none",
                    c.numeric && "text-right",
                  )}
                  onClick={() => toggleSort(c.key)}
                >
                  <span
                    className={cn(
                      "inline-flex items-center gap-1",
                      c.numeric && "flex-row-reverse",
                    )}
                  >
                    {c.label}
                    {sortKey === c.key ? (
                      dir === "asc" ? (
                        <ChevronUp className="size-3.5" />
                      ) : (
                        <ChevronDown className="size-3.5" />
                      )
                    ) : null}
                  </span>
                </TableHead>
              ))}
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((r) => (
              <TableRow
                key={r.userId}
                className="cursor-pointer"
                onClick={() => router.push(`/app/users/${r.userId}`)}
              >
                <TableCell>
                  <div className="flex items-center gap-2">
                    <UserAvatar
                      name={r.name}
                      src={r.avatarUrl}
                      seed={r.userId}
                      size="sm"
                    />
                    <span className="font-medium">{r.name ?? "—"}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {r.goalPct !== null && r.goalType ? (
                    <div className="ml-auto w-28 space-y-0.5">
                      <div className="text-muted-foreground flex justify-between text-xs tabular-nums">
                        <span>{r.goalPct}%</span>
                        <span>
                          {formatGoalValue(r.goalType, r.goalActual ?? 0)}/
                          {formatGoalValue(r.goalType, r.goalTarget ?? 0)}
                        </span>
                      </div>
                      <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                        <div
                          className="h-full rounded-full bg-sky-500"
                          style={{ width: `${r.goalPct}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-xs">
                      No goal
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.onboardingDone}/{r.onboardingTotal}{" "}
                  <span className="text-muted-foreground">
                    ({r.onboardingPct}%)
                  </span>
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {r.lastActivity ? (
                    formatDate(r.lastActivity, "relative")
                  ) : (
                    <span className="text-muted-foreground">Never</span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.closedDealsYtd}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(r.closedVolumeYtdCents, { compact: true })}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(r.gciYtdCents, { compact: true })}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-label={`Actions for ${r.name ?? "agent"}`}
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => router.push(`/app/users/${r.userId}`)}
                      >
                        View profile
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => router.push(`/app/messages`)}
                      >
                        Message
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          setNoteAgent({
                            id: r.userId,
                            name: r.name ?? "Agent",
                          })
                        }
                      >
                        Add coaching note
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          setNudgeAgent({
                            id: r.userId,
                            name: r.name ?? "Agent",
                          })
                        }
                      >
                        Send nudge
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <CoachingNoteDialog
        open={noteAgent !== null}
        onOpenChange={(o) => !o && setNoteAgent(null)}
        agent={noteAgent}
      />
      <NudgeDialog
        open={nudgeAgent !== null}
        onOpenChange={(o) => !o && setNudgeAgent(null)}
        agent={nudgeAgent}
      />
    </>
  );
}
