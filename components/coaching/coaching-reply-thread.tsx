"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { CoachingReply } from "@/lib/dashboards/drill-down";
import { submitCoachingReply } from "@/app/app/coaching/actions";
import { formatDate } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/shared/user-avatar";

/**
 * Reply thread under a coaching note. Renders existing replies chronologically
 * and an inline composer. Visible only to the subject agent + team_lead +
 * super_admin (admin_tc never sees this — the parent hides it). A new reply
 * notifies the other party via the bell badge (kind='coaching_reply').
 */
export function CoachingReplyThread({
  noteId,
  replies,
  canReply,
}: {
  noteId: string;
  replies: CoachingReply[];
  canReply: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function submit() {
    const text = body.trim();
    if (!text) return;
    startTransition(async () => {
      const res = await submitCoachingReply(noteId, text);
      if (res.ok) {
        setBody("");
        toast.success("Reply posted");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="mt-2 space-y-3 border-l-2 pl-3">
      {replies.length === 0 ? (
        <p className="text-muted-foreground text-xs">No replies yet.</p>
      ) : (
        <ul className="space-y-2.5">
          {replies.map((r) => (
            <li key={r.id} className="flex items-start gap-2">
              <UserAvatar
                name={r.authorName}
                src={r.authorAvatar}
                seed={r.authorId}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs">
                  <span className="font-medium">
                    {r.authorName ?? "Someone"}
                  </span>{" "}
                  <span className="text-muted-foreground">
                    {formatDate(r.createdAt, "relative")}
                  </span>
                </p>
                <p className="text-sm">{r.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {canReply ? (
        <div className="space-y-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write a reply…"
            rows={2}
            maxLength={5000}
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={submit}
              disabled={pending || !body.trim()}
            >
              {pending ? "Posting…" : "Reply"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
