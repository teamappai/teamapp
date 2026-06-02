"use client";

import * as React from "react";
import { toast } from "sonner";
import { MessageSquarePlus, Trash2 } from "lucide-react";

import type { CoachingEntry } from "@/lib/coaching/queries";
import type { CoachingReply } from "@/lib/dashboards/drill-down";
import { dayGroupLabel } from "@/lib/coaching/dates";
import { formatDate } from "@/lib/utils/format";
import { deleteCoachingNote } from "@/app/app/coaching/actions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { MessageSquare } from "lucide-react";
import { CoachingNoteDialog } from "@/components/coaching/coaching-note-dialog";
import { CoachingReplyThread } from "@/components/coaching/coaching-reply-thread";

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Coaching log (F-109/F-110/F-111): reverse-chron entries grouped by day with
 * "Today" / "Yesterday" / explicit-date headers and a FULL timestamp per entry.
 * Test-flagged entries are filtered out by default; the show-test toggle only
 * appears in dev. Managers can delete entries and add new notes.
 */
export function CoachingLog({
  entries,
  canDelete,
  canAddNote,
  devMode,
  agents,
  repliesByEntry,
  repliesEnabled = false,
  canReply = false,
  expandNoteId,
}: {
  entries: CoachingEntry[];
  canDelete: boolean;
  canAddNote: boolean;
  devMode: boolean;
  agents: { id: string; name: string }[];
  /** Replies grouped by coaching-note id (Phase 13). */
  repliesByEntry?: Record<string, CoachingReply[]>;
  /** Whether reply threads render at all (hidden for admin_tc — Decision 3). */
  repliesEnabled?: boolean;
  /** Whether the viewer may post replies (subject agent or team_lead). */
  canReply?: boolean;
  /** A note id to auto-expand (deep link from the bell — ?note=…). */
  expandNoteId?: string;
}) {
  const [showTest, setShowTest] = React.useState(false);
  const [noteOpen, setNoteOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>(
    expandNoteId ? { [expandNoteId]: true } : {},
  );

  const visible = entries.filter((e) => showTest || !e.is_test);

  // Group consecutive entries by their day label (entries arrive newest-first).
  const groups: Array<{ label: string; items: CoachingEntry[] }> = [];
  for (const e of visible) {
    const label = dayGroupLabel(e.occurred_at);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(e);
    else groups.push({ label, items: [e] });
  }

  function onDelete(id: string) {
    startTransition(async () => {
      const res = await deleteCoachingNote(id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Note deleted");
    });
  }

  return (
    <Card className="gap-0 py-4">
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Coaching log</h2>
          <div className="flex items-center gap-3">
            {devMode ? (
              <label className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <Switch
                  checked={showTest}
                  onCheckedChange={setShowTest}
                  aria-label="Show test data"
                />
                Show test data
              </label>
            ) : null}
            {canAddNote ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setNoteOpen(true)}
              >
                <MessageSquarePlus className="size-4" /> Add coaching note
              </Button>
            ) : null}
          </div>
        </div>

        {groups.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="No coaching notes yet"
            description="Coaching notes you add show up here, grouped by day."
          />
        ) : (
          <div className="space-y-5">
            {groups.map((group) => (
              <div key={group.label} className="space-y-2">
                <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  {group.label}
                </h3>
                <div className="space-y-2">
                  {group.items.map((e) => (
                    <div key={e.id} className="rounded-lg border p-3 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-muted-foreground text-xs">
                          <span className="text-foreground font-medium">
                            {e.coachName}
                          </span>{" "}
                          → {e.agentName} · {formatDate(e.occurred_at, "short")}{" "}
                          · {timeOf(e.occurred_at)}
                          {e.is_test ? (
                            <Badge variant="outline" className="ml-2">
                              test
                            </Badge>
                          ) : null}
                        </div>
                        {canDelete ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7 shrink-0"
                            onClick={() => onDelete(e.id)}
                            disabled={pending}
                            aria-label="Delete note"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        ) : null}
                      </div>
                      <p className="mt-1.5 whitespace-pre-wrap">{e.body}</p>
                      {repliesEnabled ? (
                        <div className="mt-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={() =>
                              setExpanded((p) => ({ ...p, [e.id]: !p[e.id] }))
                            }
                          >
                            {(() => {
                              const count = repliesByEntry?.[e.id]?.length ?? 0;
                              return count > 0
                                ? `${count} ${count === 1 ? "reply" : "replies"}`
                                : "Reply";
                            })()}
                          </Button>
                          {expanded[e.id] ? (
                            <CoachingReplyThread
                              noteId={e.id}
                              replies={repliesByEntry?.[e.id] ?? []}
                              canReply={canReply}
                            />
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <CoachingNoteDialog
        open={noteOpen}
        onOpenChange={setNoteOpen}
        agents={agents}
      />
    </Card>
  );
}
