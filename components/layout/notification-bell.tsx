"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";

import { markAllNotificationsRead } from "@/app/app/requests/actions";
import { formatDate } from "@/lib/utils/format";
import { TooltipIconButton } from "@/components/shared/tooltip-icon-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type NotificationItem = {
  id: string;
  kind: string;
  requestId: string | null;
  requestTitle: string | null;
  threadId: string | null;
  byName: string | null;
  claimed: boolean;
  read: boolean;
  createdAt: string;
};

function describe(n: NotificationItem): string {
  const title = n.requestTitle ?? "a request";
  switch (n.kind) {
    case "request_ready_for_review":
      return `“${title}” is ready for your review`;
    case "request_completed":
      return `“${title}” was completed`;
    case "request_new_comment":
      return `${n.byName ?? "Someone"} commented on “${title}”`;
    case "request_assigned":
      return n.claimed
        ? `${n.byName ?? "Someone"} claimed “${title}”`
        : `You were assigned “${title}”`;
    case "message_received":
      return `${n.byName || "Someone"} sent you a message`;
    case "message_mention":
      return `${n.byName || "Someone"} mentioned you in a message`;
    case "message_channel_mention":
      return `${n.byName || "Someone"} mentioned @channel`;
    case "coaching_nudge":
      return `${n.byName || "Your coach"} sent you a nudge`;
    case "training_nudge":
      return `${n.byName || "Your coach"} nudged you about training`;
    default:
      return title;
  }
}

/** Where a notification navigates when clicked. */
function hrefFor(n: NotificationItem): string | null {
  if (n.kind === "message_channel_mention" && n.threadId) {
    return `/app/messages/channels/${n.threadId}`;
  }
  if (n.threadId) return `/app/messages/${n.threadId}`;
  if (n.requestId) return `/app/requests/${n.requestId}`;
  return null;
}

/** Header notification bell with unread badge + dropdown (audit PA-2). */
export function NotificationBell({
  notifications,
}: {
  notifications: NotificationItem[];
}) {
  const router = useRouter();
  const unread = notifications.filter((n) => !n.read).length;

  const onOpenChange = (open: boolean) => {
    if (open && unread > 0) {
      // Mark everything read when the panel is opened (badge decrements).
      void markAllNotificationsRead().then(() => router.refresh());
    }
  };

  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <div className="relative">
          <TooltipIconButton aria-label="Notifications" tooltip="Notifications">
            <Bell className="size-5" />
          </TooltipIconButton>
          {unread > 0 ? (
            <span className="bg-destructive pointer-events-none absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <p className="text-muted-foreground px-2 py-6 text-center text-sm">
            You&rsquo;re all caught up.
          </p>
        ) : (
          <ul className="max-h-96 overflow-auto">
            {notifications.map((n) => {
              const inner = (
                <>
                  <span className="block text-sm">{describe(n)}</span>
                  <span className="text-muted-foreground text-xs">
                    {formatDate(n.createdAt, "short")}
                  </span>
                </>
              );
              const href = hrefFor(n);
              return (
                <li key={n.id}>
                  {href ? (
                    <Link
                      href={href}
                      className="hover:bg-accent block px-2 py-2"
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div className="px-2 py-2">{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
