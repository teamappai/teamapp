import type { Metadata } from "next";

import { MessagesShell } from "@/components/messages/messages-shell";
import { loadMessagesData } from "@/app/app/messages/page-data";

export const metadata: Metadata = { title: "Messages" };

export default async function MessageThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  const data = await loadMessagesData(threadId);
  return (
    <div className="-mx-4 -my-6 h-[calc(100vh-3.5rem)] sm:-mx-6">
      <MessagesShell
        threads={data.threads}
        thread={data.thread}
        members={data.members}
        currentUserId={data.currentUserId}
        companyId={data.companyId}
      />
    </div>
  );
}
