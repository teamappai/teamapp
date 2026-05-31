"use client";

import * as React from "react";
import {
  CornerUpLeft,
  GraduationCap,
  Loader2,
  MoreHorizontal,
  Pencil,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils/index";
import { UserAvatar } from "@/components/shared/user-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils/format";
import { ROLE_LABELS } from "@/lib/constants/roles";
import { LONG_MESSAGE_CHARS, REACTION_EMOJIS } from "@/lib/messages/constants";
import type { MessageView } from "@/lib/messages/types";
import { MarkdownMessage } from "@/components/messages/markdown-message";
import { AttachmentList } from "@/components/messages/attachment-list";

export type ReplyContext = {
  author: string | null;
  text: string;
  deleted: boolean;
} | null;

function NudgeBadge({ contextType }: { contextType: string }) {
  if (contextType === "coaching_nudge") {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
        <Sparkles className="size-3" /> Coaching nudge
      </span>
    );
  }
  if (contextType === "training_nudge") {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 dark:bg-sky-950 dark:text-sky-300">
        <GraduationCap className="size-3" /> Training nudge
      </span>
    );
  }
  return null;
}

export function MessageItem({
  message,
  nameOf,
  currentUserId,
  replyContext,
  canEdit,
  isReply,
  pending,
  failed,
  onReply,
  onReact,
  onEdit,
  onDelete,
  onRetry,
}: {
  message: MessageView;
  nameOf: (id: string) => string | undefined;
  currentUserId: string;
  replyContext: ReplyContext;
  /** Whether the 5-minute edit window is still open for the viewer's own msg. */
  canEdit: boolean;
  isReply: boolean;
  pending?: boolean;
  failed?: boolean;
  onReply: (message: MessageView) => void;
  onReact: (messageId: string, emoji: string) => void;
  onEdit: (messageId: string, body: string) => Promise<boolean>;
  onDelete: (messageId: string) => void;
  onRetry?: () => void;
}) {
  const mine = message.senderId === currentUserId;
  const deleted = message.deletedAt !== null;
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(message.body ?? "");
  const [savingEdit, setSavingEdit] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);

  const long = (message.body?.length ?? 0) > LONG_MESSAGE_CHARS;

  const saveEdit = async () => {
    setSavingEdit(true);
    const ok = await onEdit(message.id, draft.trim());
    setSavingEdit(false);
    if (ok) setEditing(false);
  };

  return (
    <div
      className={cn(
        "group/message hover:bg-muted/30 relative flex gap-2.5 rounded-md px-2 py-1.5 transition-colors",
        isReply && "ml-9",
      )}
    >
      <UserAvatar
        name={message.senderName}
        src={message.senderAvatarUrl}
        seed={message.senderId}
        size="default"
        className="mt-0.5"
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-sm font-semibold">
            {message.senderName ?? "Unknown"}
          </span>
          {message.senderRole ? (
            <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px] font-medium">
              {ROLE_LABELS[message.senderRole]}
            </span>
          ) : null}
          <NudgeBadge contextType={message.contextType} />
          <span className="text-muted-foreground text-xs">
            {formatDate(message.createdAt, "relative")}
          </span>
          {message.editedAt && !deleted ? (
            <span className="text-muted-foreground text-xs">(edited)</span>
          ) : null}
          {pending ? (
            <span className="text-muted-foreground flex items-center gap-1 text-xs">
              <Loader2 className="size-3 animate-spin" /> Sending…
            </span>
          ) : null}
          {failed ? (
            <button
              type="button"
              onClick={onRetry}
              className="text-destructive text-xs underline"
            >
              Failed — retry
            </button>
          ) : null}
        </div>

        {/* Reply context (flat threading — Decision 5) */}
        {replyContext ? (
          <div className="text-muted-foreground mt-0.5 mb-0.5 flex items-center gap-1 text-xs">
            <CornerUpLeft className="size-3" />
            <span className="font-medium">
              {replyContext.author ?? "Someone"}
            </span>
            <span className="truncate">
              {replyContext.deleted ? "Message deleted" : replyContext.text}
            </span>
          </div>
        ) : null}

        {/* Body */}
        {deleted ? (
          <p className="text-muted-foreground text-sm italic">
            Message deleted
          </p>
        ) : editing ? (
          <div className="mt-1 space-y-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              className="border-input focus-visible:ring-ring w-full resize-none rounded-md border bg-transparent px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => void saveEdit()}
                disabled={savingEdit}
              >
                {savingEdit ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Save"
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setDraft(message.body ?? "");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div
              className={cn(
                long && !expanded && "max-h-40 overflow-hidden",
                "relative",
              )}
            >
              {message.body ? (
                <MarkdownMessage body={message.body} nameOf={nameOf} />
              ) : null}
              {long && !expanded ? (
                <div className="from-background pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t to-transparent" />
              ) : null}
            </div>
            {long ? (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="text-primary mt-0.5 text-xs font-medium"
              >
                {expanded ? "Show less" : "Show more"}
              </button>
            ) : null}
            <AttachmentList attachments={message.attachments} />
          </>
        )}

        {/* Reaction chips */}
        {message.reactions.length > 0 && !deleted ? (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {message.reactions.map((r) => (
              <button
                key={r.emoji}
                type="button"
                onClick={() => onReact(message.id, r.emoji)}
                title={r.reactors.join(", ")}
                className={cn(
                  "flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition",
                  r.mine
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "bg-muted/40 hover:bg-muted",
                )}
              >
                <span>{r.emoji}</span>
                <span className="tabular-nums">{r.count}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Hover toolbar */}
      {!deleted && !editing && !pending ? (
        <div className="bg-background absolute -top-3 right-2 z-10 flex items-center gap-0.5 rounded-md border p-0.5 opacity-0 shadow-sm transition group-hover/message:opacity-100">
          {REACTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onReact(message.id, emoji)}
              className="hover:bg-accent flex size-7 items-center justify-center rounded text-sm"
              aria-label={`React ${emoji}`}
            >
              {emoji}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onReply(message)}
            className="hover:bg-accent text-muted-foreground flex size-7 items-center justify-center rounded"
            aria-label="Reply"
          >
            <CornerUpLeft className="size-4" />
          </button>
          {mine ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="hover:bg-accent text-muted-foreground flex size-7 items-center justify-center rounded"
                  aria-label="More"
                >
                  <MoreHorizontal className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  disabled={!canEdit}
                  onSelect={() => {
                    if (!canEdit) {
                      toast.error("The 5-minute edit window has passed.");
                      return;
                    }
                    setDraft(message.body ?? "");
                    setEditing(true);
                  }}
                >
                  <Pencil className="size-4" /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => onDelete(message.id)}
                >
                  <Trash2 className="size-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
