"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Info,
  LogOut,
  MoreHorizontal,
  Pencil,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TooltipIconButton } from "@/components/shared/tooltip-icon-button";
import { EditChannelDialog } from "@/components/messages/edit-channel-dialog";
import { ArchiveChannelDialog } from "@/components/messages/archive-channel-dialog";
import { leaveChannel } from "@/app/app/messages/actions";
import type { ThreadDetail } from "@/lib/messages/types";

export function ChannelHeaderMenu({
  channel,
  canManageChannels,
  onOpenInfo,
}: {
  channel: ThreadDetail;
  canManageChannels: boolean;
  onOpenInfo: () => void;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [archiveOpen, setArchiveOpen] = React.useState(false);

  const leave = async () => {
    if (!confirm(`Leave #${channel.name}?`)) return;
    const res = await leaveChannel({ channelId: channel.id });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    router.push("/app/messages");
    router.refresh();
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <TooltipIconButton
            aria-label="Channel options"
            tooltip="Channel options"
          >
            <MoreHorizontal className="size-5" />
          </TooltipIconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onSelect={onOpenInfo}>
            <Info className="size-4" /> View channel info
          </DropdownMenuItem>
          {canManageChannels ? (
            <>
              <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                <Pencil className="size-4" /> Edit channel
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onOpenInfo}>
                <Users className="size-4" /> Manage members
              </DropdownMenuItem>
            </>
          ) : null}
          {!channel.isGeneral ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void leave()}>
                <LogOut className="size-4" /> Leave channel
              </DropdownMenuItem>
              {canManageChannels ? (
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => setArchiveOpen(true)}
                >
                  <Trash2 className="size-4" /> Archive channel
                </DropdownMenuItem>
              ) : null}
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {canManageChannels ? (
        <>
          <EditChannelDialog
            channel={channel}
            open={editOpen}
            onOpenChange={setEditOpen}
          />
          {!channel.isGeneral ? (
            <ArchiveChannelDialog
              channelId={channel.id}
              channelName={channel.name}
              messageCount={channel.messages.length}
              open={archiveOpen}
              onOpenChange={setArchiveOpen}
            />
          ) : null}
        </>
      ) : null}
    </>
  );
}
