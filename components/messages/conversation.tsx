"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Info, Users } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils/index";
import { createClient } from "@/lib/supabase/client";
import { TooltipIconButton } from "@/components/shared/tooltip-icon-button";
import { ThreadAvatar } from "@/components/messages/thread-avatar";
import { Composer, type ComposerSubmit } from "@/components/messages/composer";
import {
  MessageItem,
  type ReplyContext,
} from "@/components/messages/message-item";
import {
  deleteMessage,
  editMessage,
  markThreadRead,
  sendMessage,
  toggleReaction,
} from "@/app/app/messages/actions";
import { EDIT_WINDOW_MS } from "@/lib/messages/constants";
import { formatDate } from "@/lib/utils/format";
import type {
  MemberLite,
  MessageView,
  ReactionGroup,
  ThreadDetail,
} from "@/lib/messages/types";

type Pending = {
  clientId: string;
  id: string | null;
  message: MessageView;
  status: "sending" | "failed";
  payload: ComposerSubmit;
  replyTo: string | null;
};

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(d, now)) return "Today";
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (sameDay(d, yest)) return "Yesterday";
  return formatDate(iso, "short");
}

function plainSnippet(body: string | null, deleted: boolean): string {
  if (deleted) return "Message deleted";
  if (!body) return "";
  return body
    .replace(/<@[0-9a-fA-F-]{36}>/g, "@mention")
    .replace(/[*_`#>]/g, "")
    .slice(0, 80);
}

export function Conversation({
  thread,
  members,
  currentUserId,
  companyId,
  infoOpen,
  onToggleInfo,
}: {
  thread: ThreadDetail;
  members: MemberLite[];
  currentUserId: string;
  companyId: string;
  infoOpen: boolean;
  onToggleInfo: () => void;
}) {
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);

  const memberById = React.useMemo(() => {
    const m = new Map<string, MemberLite>();
    for (const x of members) m.set(x.id, x);
    for (const p of thread.participants) if (!m.has(p.id)) m.set(p.id, p);
    return m;
  }, [members, thread.participants]);
  const nameOf = React.useCallback(
    (id: string) => memberById.get(id)?.name ?? undefined,
    [memberById],
  );
  const myName = memberById.get(currentUserId)?.name ?? "You";

  const [pending, setPending] = React.useState<Map<string, Pending>>(new Map());
  const [reactionPatch, setReactionPatch] = React.useState<
    Map<string, Map<string, boolean>>
  >(new Map());
  const [replyingTo, setReplyingTo] = React.useState<MessageView | null>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  // Prune optimistic messages once the server confirms them, and clear stale
  // reaction patches (the server reflects them after each refresh).
  React.useEffect(() => {
    const serverIds = new Set(thread.messages.map((m) => m.id));
    setPending((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const [cid, p] of prev) {
        if (p.id && serverIds.has(p.id)) {
          for (const a of p.payload.previews) URL.revokeObjectURL(a.url);
          next.delete(cid);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    setReactionPatch((prev) => (prev.size > 0 ? new Map() : prev));
  }, [thread.messages]);

  // ── realtime: this thread's messages + reactions → server refresh ───────────
  const refreshTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const throttledRefresh = React.useCallback(() => {
    if (refreshTimer.current) return;
    refreshTimer.current = setTimeout(() => {
      refreshTimer.current = null;
      router.refresh();
    }, 350);
  }, [router]);

  const readTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleMarkRead = React.useCallback(() => {
    if (readTimer.current) clearTimeout(readTimer.current);
    readTimer.current = setTimeout(() => {
      void markThreadRead(thread.id);
    }, 1000);
  }, [thread.id]);

  const messageIdsRef = React.useRef<Set<string>>(new Set());
  messageIdsRef.current = new Set(thread.messages.map((m) => m.id));

  React.useEffect(() => {
    const channel = supabase
      .channel(`thread:${thread.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `thread_id=eq.${thread.id}`,
        },
        (payload) => {
          const row = payload.new as { sender_id: string | null };
          throttledRefresh();
          if (row.sender_id !== currentUserId) scheduleMarkRead();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_reactions" },
        (payload) => {
          const rec = (payload.new ?? payload.old) as {
            message_id?: string;
          } | null;
          if (rec?.message_id && messageIdsRef.current.has(rec.message_id)) {
            throttledRefresh();
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, thread.id, currentUserId, throttledRefresh, scheduleMarkRead]);

  // Mark read on open (debounced 1s — F-122).
  React.useEffect(() => {
    scheduleMarkRead();
    return () => {
      if (readTimer.current) clearTimeout(readTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.id]);

  // ── reactions (optimistic) ──────────────────────────────────────────────────
  const applyPatch = React.useCallback(
    (msg: MessageView): MessageView => {
      const patch = reactionPatch.get(msg.id);
      if (!patch || patch.size === 0) return msg;
      const groups = new Map<string, ReactionGroup>(
        msg.reactions.map((r) => [
          r.emoji,
          { ...r, reactors: [...r.reactors] },
        ]),
      );
      for (const [emoji, wantMine] of patch) {
        const g = groups.get(emoji);
        const currentlyMine = g?.mine ?? false;
        if (wantMine && !currentlyMine) {
          if (g) {
            g.count += 1;
            g.mine = true;
            g.reactors.push(myName);
          } else {
            groups.set(emoji, {
              emoji,
              count: 1,
              mine: true,
              reactors: [myName],
            });
          }
        } else if (!wantMine && currentlyMine && g) {
          g.count -= 1;
          g.mine = false;
          g.reactors = g.reactors.filter((n) => n !== myName);
          if (g.count <= 0) groups.delete(emoji);
        }
      }
      return { ...msg, reactions: [...groups.values()] };
    },
    [reactionPatch, myName],
  );

  const onReact = (messageId: string, emoji: string) => {
    const msg = thread.messages.find((m) => m.id === messageId);
    const patched = msg ? applyPatch(msg) : null;
    const currentlyMine =
      patched?.reactions.find((r) => r.emoji === emoji)?.mine ?? false;
    setReactionPatch((prev) => {
      const next = new Map(prev);
      const inner = new Map(next.get(messageId) ?? []);
      inner.set(emoji, !currentlyMine);
      next.set(messageId, inner);
      return next;
    });
    void toggleReaction({ messageId, emoji }).then((res) => {
      if (!res.ok) {
        toast.error(res.error);
        setReactionPatch((prev) => {
          const next = new Map(prev);
          next.delete(messageId);
          return next;
        });
      } else {
        throttledRefresh();
      }
    });
  };

  // ── send (optimistic) ───────────────────────────────────────────────────────
  const doSend = async (
    clientId: string,
    payload: ComposerSubmit,
    replyTo: string | null,
  ) => {
    const res = await sendMessage({
      threadId: thread.id,
      clientId,
      body: payload.body,
      attachments: payload.attachments,
      replyToMessageId: replyTo,
    });
    setPending((prev) => {
      const next = new Map(prev);
      const entry = next.get(clientId);
      if (!entry) return prev;
      if (res.ok) {
        entry.id = res.messageId;
        entry.status = "sending";
      } else {
        entry.status = "failed";
        toast.error(res.error);
      }
      next.set(clientId, { ...entry });
      return next;
    });
    if (res.ok) router.refresh();
  };

  const onSubmit = async (payload: ComposerSubmit) => {
    const clientId = crypto.randomUUID();
    const replyTo = replyingTo?.id ?? null;
    const me = memberById.get(currentUserId);
    const optimistic: MessageView = {
      id: clientId,
      threadId: thread.id,
      senderId: currentUserId,
      senderName: me?.name ?? myName,
      senderAvatarUrl: me?.avatarUrl ?? null,
      senderRole: me?.role ?? null,
      body: payload.body.trim() ? payload.body : null,
      attachments: payload.previews,
      replyToMessageId: replyTo,
      editedAt: null,
      deletedAt: null,
      createdAt: new Date().toISOString(),
      contextType: "normal",
      contextPayload: null,
      reactions: [],
    };
    setPending((prev) => {
      const next = new Map(prev);
      next.set(clientId, {
        clientId,
        id: null,
        message: optimistic,
        status: "sending",
        payload,
        replyTo,
      });
      return next;
    });
    setReplyingTo(null);
    await doSend(clientId, payload, replyTo);
  };

  const onEdit = async (messageId: string, body: string): Promise<boolean> => {
    const res = await editMessage({ messageId, body });
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    router.refresh();
    return true;
  };

  const onDelete = (messageId: string) => {
    if (!confirm("Delete this message? This can't be undone.")) return;
    void deleteMessage(messageId).then((res) => {
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });
  };

  // ── assemble render list (flat threading — Decision 5) ──────────────────────
  const { rendered, messagesById } = React.useMemo(() => {
    const confirmed = thread.messages.map(applyPatch);
    const pendingMsgs = [...pending.values()]
      .filter((p) => !(p.id && confirmed.some((m) => m.id === p.id)))
      .map((p) => ({
        ...p.message,
        _pending: true as const,
        _failed: p.status === "failed",
        _clientId: p.clientId,
      }));

    const all: Array<
      MessageView & {
        _pending?: boolean;
        _failed?: boolean;
        _clientId?: string;
      }
    > = [...confirmed, ...pendingMsgs].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );

    const byId = new Map(all.map((m) => [m.id, m]));
    // Resolve each message's one-level anchor.
    const anchorOf = (m: MessageView): string | null => {
      if (!m.replyToMessageId) return null;
      const parent = byId.get(m.replyToMessageId);
      if (parent && parent.replyToMessageId) return parent.replyToMessageId;
      return m.replyToMessageId;
    };

    const repliesByAnchor = new Map<string, typeof all>();
    const topLevel: typeof all = [];
    for (const m of all) {
      const anchor = anchorOf(m);
      if (anchor && byId.has(anchor)) {
        const arr = repliesByAnchor.get(anchor) ?? [];
        arr.push(m);
        repliesByAnchor.set(anchor, arr);
      } else {
        topLevel.push(m);
      }
    }

    const order: Array<{
      message: MessageView & {
        _pending?: boolean;
        _failed?: boolean;
        _clientId?: string;
      };
      isReply: boolean;
    }> = [];
    for (const m of topLevel) {
      order.push({ message: m, isReply: false });
      for (const r of repliesByAnchor.get(m.id) ?? []) {
        order.push({ message: r, isReply: true });
      }
    }
    return { rendered: order, messagesById: byId };
  }, [thread.messages, pending, applyPatch]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [rendered.length]);

  const others = thread.participants.filter((p) => p.id !== currentUserId);

  const replyContextFor = (m: MessageView): ReplyContext => {
    if (!m.replyToMessageId) return null;
    const parent = messagesById.get(m.replyToMessageId);
    if (!parent) return null;
    return {
      author: parent.senderName,
      text: plainSnippet(parent.body, parent.deletedAt !== null),
      deleted: parent.deletedAt !== null,
    };
  };

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
        <ThreadAvatar type={thread.type} others={others} size="sm" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold">{thread.name}</h2>
          <p className="text-muted-foreground flex items-center gap-1 truncate text-xs">
            <Users className="size-3" />
            {thread.participants.length} member
            {thread.participants.length === 1 ? "" : "s"}
          </p>
        </div>
        <TooltipIconButton
          aria-label="Thread info"
          tooltip="Details"
          onClick={onToggleInfo}
          className={cn(infoOpen && "bg-accent")}
        >
          <Info className="size-5" />
        </TooltipIconButton>
      </div>

      {/* Messages */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        {rendered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="text-sm font-medium">No messages yet</p>
            <p className="text-muted-foreground text-sm">
              Say hi to your team.
            </p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {rendered.map(({ message, isReply }, i) => {
              const prev = rendered[i - 1]?.message;
              const showDay =
                !prev ||
                dayLabel(prev.createdAt) !== dayLabel(message.createdAt);
              const mine = message.senderId === currentUserId;
              const canEdit =
                mine &&
                Date.now() - new Date(message.createdAt).getTime() <
                  EDIT_WINDOW_MS;
              const m = message as MessageView & {
                _pending?: boolean;
                _failed?: boolean;
                _clientId?: string;
              };
              return (
                <React.Fragment key={message.id}>
                  {showDay ? (
                    <div className="my-2 flex items-center gap-3 px-2">
                      <span className="bg-border h-px flex-1" />
                      <span className="text-muted-foreground text-xs font-medium">
                        {dayLabel(message.createdAt)}
                      </span>
                      <span className="bg-border h-px flex-1" />
                    </div>
                  ) : null}
                  <MessageItem
                    message={message}
                    nameOf={nameOf}
                    currentUserId={currentUserId}
                    replyContext={replyContextFor(message)}
                    canEdit={canEdit}
                    isReply={isReply}
                    pending={m._pending && !m._failed}
                    failed={m._failed}
                    onReply={setReplyingTo}
                    onReact={onReact}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onRetry={() => {
                      if (m._clientId) {
                        const entry = pending.get(m._clientId);
                        if (entry)
                          void doSend(
                            entry.clientId,
                            entry.payload,
                            entry.replyTo,
                          );
                      }
                    }}
                  />
                </React.Fragment>
              );
            })}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <Composer
        threadId={thread.id}
        companyId={companyId}
        members={members.filter((m) => m.id !== currentUserId)}
        replyingTo={
          replyingTo
            ? {
                id: replyingTo.id,
                author: replyingTo.senderName,
                snippet: plainSnippet(
                  replyingTo.body,
                  replyingTo.deletedAt !== null,
                ),
              }
            : null
        }
        onCancelReply={() => setReplyingTo(null)}
        onSubmit={onSubmit}
      />
    </div>
  );
}
