"use client";

import * as React from "react";
import Link from "next/link";
import { MessageSquare, Bell, NotebookPen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CoachingNoteDialog } from "@/components/coaching/coaching-note-dialog";
import { NudgeDialog } from "@/components/coaching/nudge-dialog";

/**
 * Header quick-actions for the drill-down. "Send message" links to messages;
 * "Send nudge" opens the nudge composer (creates a DM, Decision 14); "Add
 * coaching note" opens the note composer. The latter two are coach-only; the
 * page hides them for admin_tc viewers.
 */
export function DrillDownActions({
  agent,
  canCoach,
}: {
  agent: { id: string; name: string };
  canCoach: boolean;
}) {
  const [note, setNote] = React.useState(false);
  const [nudge, setNudge] = React.useState(false);

  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild size="sm" variant="outline">
        <Link href="/app/messages">
          <MessageSquare className="size-4" /> Send message
        </Link>
      </Button>
      {canCoach ? (
        <>
          <Button size="sm" variant="outline" onClick={() => setNudge(true)}>
            <Bell className="size-4" /> Send nudge
          </Button>
          <Button size="sm" variant="outline" onClick={() => setNote(true)}>
            <NotebookPen className="size-4" /> Add coaching note
          </Button>
          <CoachingNoteDialog
            open={note}
            onOpenChange={setNote}
            agent={agent}
          />
          <NudgeDialog open={nudge} onOpenChange={setNudge} agent={agent} />
        </>
      ) : null}
    </div>
  );
}
