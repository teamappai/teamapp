"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MessagesSquare } from "lucide-react";

import { cn } from "@/lib/utils/index";
import { createClient } from "@/lib/supabase/client";
import { ThreadList } from "@/components/messages/thread-list";
import { Conversation } from "@/components/messages/conversation";
import { ThreadInfo } from "@/components/messages/thread-info";
import type {
  ChannelSummary,
  MemberLite,
  ThreadDetail,
  ThreadSummary,
} from "@/lib/messages/types";

/**
 * Three-pane Messages layout (F-090: the center always fills its height, so
 * there's never a tall blank band above the conversation). Switching threads is
 * a normal navigation to /app/messages/[id]; this client shell adds the realtime
 * "something changed in one of my threads" refresh that keeps the unread badges
 * (header + list) live without a manual reload.
 */
export function MessagesShell({
  threads,
  channels,
  thread,
  members,
  currentUserId,
  companyId,
  canManageChannels,
}: {
  threads: ThreadSummary[];
  channels: ChannelSummary[];
  thread: ThreadDetail | null;
  members: MemberLite[];
  currentUserId: string;
  companyId: string;
  canManageChannels: boolean;
}) {
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const [infoOpen, setInfoOpen] = React.useState(false);

  // Global watcher: any new message in a thread/channel I'm in refreshes server
  // data (left-rail counts + header badge share one source — F-122). Includes
  // channels so their unread badges stay live (and system notices arrive).
  const threadIdSet = React.useRef<Set<string>>(new Set());
  threadIdSet.current = new Set([
    ...threads.map((t) => t.id),
    ...channels.map((c) => c.id),
  ]);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    const channel = supabase
      .channel("messages:global")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const row = payload.new as {
            thread_id?: string;
            sender_id?: string | null;
          };
          if (
            row.thread_id &&
            threadIdSet.current.has(row.thread_id) &&
            row.sender_id !== currentUserId
          ) {
            if (timer.current) return;
            timer.current = setTimeout(() => {
              timer.current = null;
              router.refresh();
            }, 700);
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, currentUserId, router]);

  return (
    <div className="flex h-full w-full">
      <div
        className={cn(
          "w-full shrink-0 border-r md:flex md:w-80",
          thread ? "hidden md:block" : "block",
        )}
      >
        <ThreadList
          threads={threads}
          channels={channels}
          selectedThreadId={thread?.id ?? null}
          currentUserId={currentUserId}
          members={members}
          canManageChannels={canManageChannels}
        />
      </div>

      <div className={cn("min-w-0 flex-1", thread ? "flex" : "hidden md:flex")}>
        {thread ? (
          <Conversation
            key={thread.id}
            thread={thread}
            members={members}
            currentUserId={currentUserId}
            companyId={companyId}
            canManageChannels={canManageChannels}
            infoOpen={infoOpen}
            onToggleInfo={() => setInfoOpen((v) => !v)}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center px-6 text-center">
            <span className="bg-muted text-muted-foreground mb-3 flex size-12 items-center justify-center rounded-full">
              <MessagesSquare className="size-6" />
            </span>
            <p className="text-sm font-medium">Select a conversation</p>
            <p className="text-muted-foreground mt-0.5 max-w-xs text-sm">
              No conversations yet — start one with the + button to say hi to
              your team.
            </p>
          </div>
        )}
      </div>

      {thread && infoOpen ? (
        <div className="hidden w-80 shrink-0 border-l lg:block">
          <ThreadInfo
            thread={thread}
            members={members}
            currentUserId={currentUserId}
            canManageChannels={canManageChannels}
            onClose={() => setInfoOpen(false)}
          />
        </div>
      ) : null}
    </div>
  );
}
