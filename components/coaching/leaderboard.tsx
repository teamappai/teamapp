"use client";

import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  MessageSquarePlus,
  MoreHorizontal,
  Send,
  Target,
} from "lucide-react";

import {
  leaderboardCount,
  leaderboardCurrency,
  sortLeaderboard,
  type LeaderboardRow,
  type LeaderboardSortKey,
  type SortDir,
} from "@/lib/coaching/aggregate";
import type { GoalProgress } from "@/lib/coaching/queries";
import { formatDate } from "@/lib/utils/format";
import { cn } from "@/lib/utils/index";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UserAvatar } from "@/components/shared/user-avatar";
import { NudgeDialog } from "@/components/coaching/nudge-dialog";
import { CoachingNoteDialog } from "@/components/coaching/coaching-note-dialog";
import { GoalsDrawer } from "@/components/coaching/goals-drawer";

type ColKey = LeaderboardSortKey;
const COLUMNS: Array<{ key: ColKey; label: string; numeric: boolean }> = [
  { key: "name", label: "Agent", numeric: false },
  { key: "gciCents", label: "GCI", numeric: true },
  { key: "closedVolumeCents", label: "Closed Volume", numeric: true },
  { key: "closedDeals", label: "Closed Deals", numeric: true },
  { key: "appointments", label: "Appointments", numeric: true },
  { key: "conversations", label: "Conversations", numeric: true },
  { key: "lastActivityAt", label: "Last activity", numeric: false },
];

type DialogState = {
  kind: "nudge" | "note" | "goals";
  agent: { id: string; name: string };
} | null;

export function Leaderboard({
  rows,
  goalsByAgent,
  isCoach,
  highlightUserId,
}: {
  rows: LeaderboardRow[];
  goalsByAgent: Record<string, GoalProgress[]>;
  /** Coaches see the kebab actions (nudge / note / goals). */
  isCoach: boolean;
  /** The viewing agent's own row, highlighted in the self-visible view. */
  highlightUserId?: string | null;
}) {
  const [sortKey, setSortKey] = React.useState<ColKey>("gciCents");
  const [dir, setDir] = React.useState<SortDir>("desc");
  const [dialog, setDialog] = React.useState<DialogState>(null);

  const sorted = sortLeaderboard(rows, sortKey, dir);

  function toggleSort(key: ColKey) {
    if (key === sortKey) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setDir(key === "name" ? "asc" : "desc");
    }
  }

  const activeAgent = dialog?.agent ?? null;

  return (
    <Card className="gap-0 py-4">
      <CardContent className="space-y-3">
        <h2 className="text-sm font-semibold">Leaderboard</h2>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {COLUMNS.map((c) => (
                  <TableHead
                    key={c.key}
                    className={cn(c.numeric && "text-right")}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(c.key)}
                      className={cn(
                        "hover:text-foreground inline-flex items-center gap-1",
                        c.numeric && "flex-row-reverse",
                      )}
                    >
                      {c.label}
                      {sortKey === c.key ? (
                        dir === "asc" ? (
                          <ArrowUp className="size-3" />
                        ) : (
                          <ArrowDown className="size-3" />
                        )
                      ) : null}
                    </button>
                  </TableHead>
                ))}
                <TableHead className="w-10 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((row) => (
                <TableRow
                  key={row.userId}
                  className={cn(
                    row.userId === highlightUserId && "bg-muted/40",
                  )}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <UserAvatar
                        name={row.name}
                        src={row.avatarUrl}
                        seed={row.userId}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <div className="truncate font-medium">{row.name}</div>
                        {row.goalLabel ? (
                          <div className="text-muted-foreground truncate text-xs">
                            Goal: {row.goalLabel}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {leaderboardCurrency(row.gciCents)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {leaderboardCurrency(row.closedVolumeCents)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {leaderboardCount(row.closedDeals)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {leaderboardCount(row.appointments)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {leaderboardCount(row.conversations)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-right text-sm">
                    {row.lastActivityAt
                      ? formatDate(row.lastActivityAt, "relative")
                      : "Never logged"}
                  </TableCell>
                  <TableCell className="text-right">
                    {isCoach ? (
                      <DropdownMenu>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Actions for ${row.name}`}
                              >
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                          </TooltipTrigger>
                          <TooltipContent>Coaching actions</TooltipContent>
                        </Tooltip>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() =>
                              setDialog({
                                kind: "goals",
                                agent: { id: row.userId, name: row.name },
                              })
                            }
                          >
                            <Target className="size-4" /> Set goals
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              setDialog({
                                kind: "note",
                                agent: { id: row.userId, name: row.name },
                              })
                            }
                          >
                            <MessageSquarePlus className="size-4" /> Add
                            coaching note
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              setDialog({
                                kind: "nudge",
                                agent: { id: row.userId, name: row.name },
                              })
                            }
                          >
                            <Send className="size-4" /> Send nudge
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* Shared dialogs driven by row actions */}
      <NudgeDialog
        open={dialog?.kind === "nudge"}
        onOpenChange={(o) => !o && setDialog(null)}
        agent={activeAgent}
      />
      <CoachingNoteDialog
        open={dialog?.kind === "note"}
        onOpenChange={(o) => !o && setDialog(null)}
        agent={activeAgent}
      />
      <GoalsDrawer
        open={dialog?.kind === "goals"}
        onOpenChange={(o) => !o && setDialog(null)}
        agentName={activeAgent?.name ?? null}
        userId={activeAgent?.id ?? null}
        goals={activeAgent ? (goalsByAgent[activeAgent.id] ?? []) : []}
        defaultCategory="input"
      />
    </Card>
  );
}
