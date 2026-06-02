import type { Metadata } from "next";

import { MessagesShell } from "@/components/messages/messages-shell";
import { loadMessagesData } from "@/app/app/messages/page-data";

export const metadata: Metadata = { title: "Channel" };

/**
 * Friendly, shareable channel URL. Channels ARE threads, so this renders the
 * same three-pane shell as /app/messages/[threadId] with the channel selected.
 * RLS makes a non-member's deep link to a private channel resolve to nothing,
 * which the loader bounces back to /app/messages (criterion 10).
 */
export default async function ChannelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await loadMessagesData(id);
  return (
    <div className="-mx-4 -my-6 h-[calc(100vh-3.5rem)] sm:-mx-6">
      <MessagesShell
        threads={data.threads}
        channels={data.channels}
        thread={data.thread}
        members={data.members}
        currentUserId={data.currentUserId}
        companyId={data.companyId}
        canManageChannels={data.canManageChannels}
      />
    </div>
  );
}
