"use client";

import * as React from "react";
import Link from "next/link";
import { Hash, Lock, Plus, Search } from "lucide-react";

import { cn } from "@/lib/utils/index";
import { formatDate } from "@/lib/utils/format";
import { ThreadAvatar } from "@/components/messages/thread-avatar";
import { NewThreadMenu } from "@/components/messages/new-thread-menu";
import type {
  ChannelSummary,
  MemberLite,
  ThreadSummary,
} from "@/lib/messages/types";

const SECTION_LIMIT = 8;

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const n = new Date();
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
}

function previewText(t: ThreadSummary): string {
  if (!t.lastMessage) return "No messages yet";
  if (t.lastMessage.deleted) return "Message deleted";
  const who = t.lastMessage.senderName
    ? `${t.lastMessage.senderName.split(/\s+/)[0]}: `
    : "";
  const body = (t.lastMessage.body ?? "")
    .replace(/<@channel>/g, "@channel")
    .replace(/<@[0-9a-fA-F-]{36}>/g, "@mention")
    .replace(/[*_`#>]/g, "");
  return `${who}${body || "Sent an attachment"}`;
}

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="bg-primary text-primary-foreground flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function SectionHeader({
  label,
  action,
}: {
  label: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-3 pt-3 pb-1">
      <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        {label}
      </h3>
      {action}
    </div>
  );
}

export function ThreadList({
  threads,
  channels,
  selectedThreadId,
  currentUserId,
  members,
  canManageChannels,
}: {
  threads: ThreadSummary[];
  channels: ChannelSummary[];
  selectedThreadId: string | null;
  currentUserId: string;
  members: MemberLite[];
  canManageChannels: boolean;
}) {
  const [search, setSearch] = React.useState("");
  const [showAllChannels, setShowAllChannels] = React.useState(false);
  const [showAllDms, setShowAllDms] = React.useState(false);

  const q = search.trim().toLowerCase();

  const filteredChannels = React.useMemo(() => {
    if (!q) return channels;
    return channels.filter((c) =>
      [c.name, c.description ?? ""].join(" ").toLowerCase().includes(q),
    );
  }, [channels, q]);

  const filteredThreads = React.useMemo(() => {
    if (!q) return threads;
    return threads.filter((t) =>
      [t.name, previewText(t), ...t.participants.map((p) => p.name ?? "")]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [threads, q]);

  const visibleChannels = showAllChannels
    ? filteredChannels
    : filteredChannels.slice(0, SECTION_LIMIT);
  const visibleThreads = showAllDms
    ? filteredThreads
    : filteredThreads.slice(0, SECTION_LIMIT);

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex items-center gap-2 border-b p-3">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search messages"
            className="border-input focus-visible:ring-ring h-9 w-full rounded-md border bg-transparent pr-2 pl-8 text-sm focus-visible:ring-2 focus-visible:outline-none"
          />
        </div>
        <NewThreadMenu
          members={members.filter((m) => m.id !== currentUserId)}
          canManageChannels={canManageChannels}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-3">
        {/* ── Channels ── */}
        <SectionHeader
          label="Channels"
          action={
            <Link
              href="/app/messages/channels"
              aria-label="Browse all channels"
              title="Browse all channels"
              className="text-muted-foreground hover:bg-accent hover:text-foreground flex size-6 items-center justify-center rounded"
            >
              <Plus className="size-4" />
            </Link>
          }
        />
        {filteredChannels.length === 0 ? (
          <p className="text-muted-foreground px-3 py-1.5 text-xs">
            {channels.length === 0 ? (
              <Link href="/app/messages/channels" className="hover:underline">
                Browse channels to join
              </Link>
            ) : (
              "No channels match."
            )}
          </p>
        ) : (
          <ul>
            {visibleChannels.map((c) => {
              const active = c.id === selectedThreadId;
              return (
                <li key={c.id}>
                  <Link
                    href={`/app/messages/channels/${c.id}`}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 transition-colors",
                      active ? "bg-accent" : "hover:bg-muted/50",
                    )}
                  >
                    {c.visibility === "private" ? (
                      <Lock className="text-muted-foreground size-3.5 shrink-0" />
                    ) : (
                      <Hash className="text-muted-foreground size-3.5 shrink-0" />
                    )}
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate text-sm",
                        c.unreadCount > 0 ? "font-semibold" : "font-medium",
                      )}
                    >
                      {c.name}
                    </span>
                    <UnreadBadge count={c.unreadCount} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {filteredChannels.length > SECTION_LIMIT ? (
          <button
            type="button"
            onClick={() => setShowAllChannels((v) => !v)}
            className="text-muted-foreground hover:text-foreground px-3 py-1 text-xs font-medium"
          >
            {showAllChannels
              ? "Show less"
              : `Show ${filteredChannels.length - SECTION_LIMIT} more`}
          </button>
        ) : null}

        {/* ── Direct messages ── */}
        <SectionHeader label="Direct Messages" />
        {filteredThreads.length === 0 ? (
          <p className="text-muted-foreground px-3 py-1.5 text-xs">
            {threads.length === 0
              ? "No conversations yet — start one with + New."
              : "No conversations match."}
          </p>
        ) : (
          <ul>
            {visibleThreads.map((t) => {
              const others = t.participants.filter(
                (p) => p.id !== currentUserId,
              );
              const unread = t.unreadCount > 0;
              const active = t.id === selectedThreadId;
              const ts = t.lastMessage?.createdAt ?? t.updatedAt;
              return (
                <li key={t.id}>
                  <Link
                    href={`/app/messages/${t.id}`}
                    className={cn(
                      "flex items-start gap-3 px-3 py-2.5 transition-colors",
                      active ? "bg-accent" : "hover:bg-muted/50",
                    )}
                  >
                    <ThreadAvatar type={t.type} others={others} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "min-w-0 flex-1 truncate text-sm",
                            unread ? "font-semibold" : "font-medium",
                          )}
                        >
                          {t.name}
                        </span>
                        <span className="text-muted-foreground shrink-0 text-xs">
                          {formatDate(ts, isToday(ts) ? "relative" : "short")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <p
                          className={cn(
                            "min-w-0 flex-1 truncate text-xs",
                            unread
                              ? "text-foreground font-medium"
                              : "text-muted-foreground",
                          )}
                        >
                          {previewText(t)}
                        </p>
                        <UnreadBadge count={t.unreadCount} />
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {filteredThreads.length > SECTION_LIMIT ? (
          <button
            type="button"
            onClick={() => setShowAllDms((v) => !v)}
            className="text-muted-foreground hover:text-foreground px-3 py-1 text-xs font-medium"
          >
            {showAllDms
              ? "Show less"
              : `Show ${filteredThreads.length - SECTION_LIMIT} more`}
          </button>
        ) : null}
      </div>
    </div>
  );
}
