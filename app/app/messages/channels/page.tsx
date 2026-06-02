import type { Metadata } from "next";

import { ChannelBrowser } from "@/components/messages/channel-browser";
import { loadChannelBrowseData } from "@/app/app/messages/page-data";

export const metadata: Metadata = { title: "Channels" };

export default async function ChannelsBrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const { new: newParam } = await searchParams;
  const data = await loadChannelBrowseData();
  const canOpenCreate = data.canManageChannels && newParam === "1";

  return (
    <div className="-mx-4 -my-6 h-[calc(100vh-3.5rem)] sm:-mx-6">
      <ChannelBrowser
        channels={data.channels}
        members={data.members.filter((m) => m.id !== data.currentUserId)}
        canManageChannels={data.canManageChannels}
        autoOpenCreate={canOpenCreate}
      />
    </div>
  );
}
