"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import type {
  AttentionItem,
  AttentionTrigger,
} from "@/lib/dashboards/team-lead";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CoachingNoteDialog } from "@/components/coaching/coaching-note-dialog";
import { NudgeDialog } from "@/components/coaching/nudge-dialog";

const TRIGGER_LABEL: Record<AttentionTrigger, string> = {
  no_activity: "No activity 3+ days",
  below_pace: "Below goal pace",
  stalled_deal: "Stalled deal",
  stalled_training: "Stalled training",
};

const ACTION_LABEL: Record<AttentionTrigger, string> = {
  no_activity: "Send check-in",
  below_pace: "Review coaching",
  stalled_deal: "Review deal",
  stalled_training: "Send training nudge",
};

export function CoachingAttention({ items }: { items: AttentionItem[] }) {
  const router = useRouter();
  const [noteAgent, setNoteAgent] = React.useState<{
    id: string;
    name: string;
  } | null>(null);
  const [nudgeAgent, setNudgeAgent] = React.useState<{
    id: string;
    name: string;
  } | null>(null);

  if (items.length === 0) {
    return (
      <p className="text-muted-foreground rounded-md border py-8 text-center text-sm">
        Everyone&rsquo;s on track. Nice work.
      </p>
    );
  }

  function act(item: AttentionItem) {
    const agent = { id: item.userId, name: item.name ?? "Agent" };
    switch (item.trigger) {
      case "no_activity":
        setNudgeAgent(agent); // DM check-in via the nudge composer
        break;
      case "below_pace":
        setNoteAgent(agent);
        break;
      case "stalled_deal":
        if (item.dealId) router.push(`/app/deals/${item.dealId}`);
        break;
      case "stalled_training":
        setNudgeAgent(agent);
        break;
    }
  }

  return (
    <>
      <ul className="divide-border divide-y rounded-md border">
        {items.map((item) => (
          <li
            key={`${item.userId}:${item.trigger}`}
            className="flex items-center gap-3 px-3 py-2.5"
          >
            <UserAvatar
              name={item.name}
              src={item.avatarUrl}
              seed={item.userId}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {item.name ?? "Agent"}
              </p>
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    item.trigger === "below_pace" ? "destructive" : "secondary"
                  }
                  className="text-[10px]"
                >
                  {TRIGGER_LABEL[item.trigger]}
                </Badge>
                <span className="text-muted-foreground truncate text-xs">
                  {item.reason}
                </span>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => act(item)}>
              {ACTION_LABEL[item.trigger]}
            </Button>
          </li>
        ))}
      </ul>

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
