"use client";

import * as React from "react";
import { Hash, MessageSquarePlus, Plus, Users } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NewMessageDialog } from "@/components/messages/new-message-dialog";
import { CreateChannelDialog } from "@/components/messages/create-channel-dialog";
import type { MemberLite } from "@/lib/messages/types";

/**
 * The "+ New" entry point in the messages left rail (Phase 11.5). A dropdown that
 * opens the right dialog: a direct message / group (same picker, 1 vs many) or a
 * new channel. The channel option only appears for team_lead / admin_tc.
 */
export function NewThreadMenu({
  members,
  canManageChannels,
}: {
  /** Company members (already excludes the current user). */
  members: MemberLite[];
  canManageChannels: boolean;
}) {
  const [dialog, setDialog] = React.useState<null | "message" | "channel">(
    null,
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="New"
            className="bg-primary text-primary-foreground hover:bg-primary/90 flex h-9 shrink-0 items-center gap-1 rounded-md px-2.5 text-sm font-medium transition"
          >
            <Plus className="size-4" /> New
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setDialog("message")}>
            <MessageSquarePlus className="size-4" /> New direct message
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialog("message")}>
            <Users className="size-4" /> New group
          </DropdownMenuItem>
          {canManageChannels ? (
            <DropdownMenuItem onSelect={() => setDialog("channel")}>
              <Hash className="size-4" /> New channel
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <NewMessageDialog
        members={members}
        open={dialog === "message"}
        onOpenChange={(o) => setDialog(o ? "message" : null)}
      />
      {canManageChannels ? (
        <CreateChannelDialog
          members={members}
          open={dialog === "channel"}
          onOpenChange={(o) => setDialog(o ? "channel" : null)}
        />
      ) : null}
    </>
  );
}
