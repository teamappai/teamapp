"use client";

import * as React from "react";

import type { DrillCoachingNote } from "@/lib/dashboards/drill-down";
import { formatDate } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CoachingNoteDialog } from "@/components/coaching/coaching-note-dialog";
import { CoachingReplyThread } from "@/components/coaching/coaching-reply-thread";
import { dayGroupLabel } from "@/lib/coaching/dates";

type RangeFilter = "all" | "30" | "90";

const FILTERS: { key: RangeFilter; label: string }[] = [
  { key: "30", label: "Last 30 days" },
  { key: "90", label: "Last 90 days" },
  { key: "all", label: "All time" },
];

function withinFilter(occurredAt: string, filter: RangeFilter): boolean {
  if (filter === "all") return true;
  const days = Number(filter);
  const cutoff = Date.now() - days * 86_400_000;
  return new Date(occurredAt).getTime() >= cutoff;
}

export function DrillDownCoaching({
  notes,
  agent,
  canCoach,
  canReply,
  repliesHidden,
}: {
  notes: DrillCoachingNote[];
  agent: { id: string; name: string };
  /** team_lead / super_admin may add notes. */
  canCoach: boolean;
  /** subject agent OR team_lead / super_admin may reply (never admin_tc). */
  canReply: boolean;
  /** admin_tc viewers see note bodies but no reply threads (Decision 3). */
  repliesHidden: boolean;
}) {
  const [filter, setFilter] = React.useState<RangeFilter>("all");
  const [composerOpen, setComposerOpen] = React.useState(false);
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});

  const visible = notes.filter((n) => withinFilter(n.occurredAt, filter));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          <Button
            size="sm"
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => setFilter("all")}
          >
            All
          </Button>
          {FILTERS.filter((f) => f.key !== "all").map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={filter === f.key ? "default" : "outline"}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        {canCoach ? (
          <Button size="sm" onClick={() => setComposerOpen(true)}>
            + Add coaching note
          </Button>
        ) : null}
      </div>

      {repliesHidden ? (
        <p className="text-muted-foreground text-xs">
          Reply threads are private to the agent and team lead.
        </p>
      ) : null}

      {visible.length === 0 ? (
        <p className="text-muted-foreground rounded-md border py-8 text-center text-sm">
          No coaching notes in this range.
        </p>
      ) : (
        <ul className="space-y-3">
          {visible.map((n) => {
            const isOpen = expanded[n.id] ?? false;
            return (
              <li key={n.id}>
                <Card>
                  <CardContent className="space-y-2 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-muted-foreground text-xs">
                          {n.authorName ?? "Coach"} ·{" "}
                          {dayGroupLabel(n.occurredAt)} ·{" "}
                          {formatDate(n.occurredAt, "short")}
                        </p>
                        <p className="text-sm">{n.body}</p>
                      </div>
                      {!repliesHidden ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setExpanded((p) => ({ ...p, [n.id]: !isOpen }))
                          }
                        >
                          {n.replies.length > 0
                            ? `${n.replies.length} ${n.replies.length === 1 ? "reply" : "replies"}`
                            : "Reply"}
                        </Button>
                      ) : null}
                    </div>

                    {!repliesHidden && isOpen ? (
                      <CoachingReplyThread
                        noteId={n.id}
                        replies={n.replies}
                        canReply={canReply}
                      />
                    ) : null}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <CoachingNoteDialog
        open={composerOpen}
        onOpenChange={setComposerOpen}
        agent={agent}
      />
    </div>
  );
}
