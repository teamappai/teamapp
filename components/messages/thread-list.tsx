"use client";

import * as React from "react";
import Link from "next/link";
import { Pencil, Search } from "lucide-react";

import { cn } from "@/lib/utils/index";
import { formatDate } from "@/lib/utils/format";
import { ThreadAvatar } from "@/components/messages/thread-avatar";
import { NewMessageDialog } from "@/components/messages/new-message-dialog";
import type { MemberLite, ThreadSummary } from "@/lib/messages/types";

type Tab = "all" | "unread" | "dms" | "groups";

const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "dms", label: "DMs" },
  { id: "groups", label: "Groups" },
];

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
    .replace(/<@[0-9a-fA-F-]{36}>/g, "@mention")
    .replace(/[*_`#>]/g, "");
  return `${who}${body || "Sent an attachment"}`;
}

export function ThreadList({
  threads,
  selectedThreadId,
  currentUserId,
  members,
}: {
  threads: ThreadSummary[];
  selectedThreadId: string | null;
  currentUserId: string;
  members: MemberLite[];
}) {
  const [tab, setTab] = React.useState<Tab>("all");
  const [search, setSearch] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return threads.filter((t) => {
      if (tab === "unread" && t.unreadCount === 0) return false;
      if (tab === "dms" && t.type !== "direct") return false;
      if (tab === "groups" && t.type !== "group") return false;
      if (!q) return true;
      const haystack = [
        t.name,
        previewText(t),
        ...t.participants.map((p) => p.name ?? ""),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [threads, tab, search]);

  return (
    <div className="flex h-full w-full flex-col">
      <div className="space-y-2 border-b p-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations"
              className="border-input focus-visible:ring-ring h-9 w-full rounded-md border bg-transparent pr-2 pl-8 text-sm focus-visible:ring-2 focus-visible:outline-none"
            />
          </div>
          <NewMessageDialog
            members={members.filter((m) => m.id !== currentUserId)}
            trigger={
              <button
                type="button"
                aria-label="New message"
                className="bg-primary text-primary-foreground hover:bg-primary/90 flex size-9 shrink-0 items-center justify-center rounded-md transition"
              >
                <Pencil className="size-4" />
              </button>
            }
          />
        </div>

        <div className="bg-muted/50 flex gap-0.5 rounded-md p-0.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "flex-1 rounded px-2 py-1 text-xs font-medium transition",
                tab === t.id
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-medium">
              {threads.length === 0 ? "No conversations yet" : "Nothing here"}
            </p>
            <p className="text-muted-foreground mt-0.5 text-sm">
              {threads.length === 0
                ? "Start one with the + button"
                : "Try a different tab or search"}
            </p>
          </div>
        ) : (
          <ul>
            {filtered.map((t) => {
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
                      "flex items-start gap-3 border-b px-3 py-2.5 transition-colors",
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
                        {unread ? (
                          <span className="bg-primary text-primary-foreground flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold">
                            {t.unreadCount > 99 ? "99+" : t.unreadCount}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
