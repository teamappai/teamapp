import "server-only";
import { redirect } from "next/navigation";

import { getSessionProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import {
  getThreadDetail,
  listCompanyMembers,
  listThreads,
} from "@/lib/messages/queries";
import type {
  MemberLite,
  ThreadDetail,
  ThreadSummary,
} from "@/lib/messages/types";

export type MessagesPageData = {
  threads: ThreadSummary[];
  members: MemberLite[];
  thread: ThreadDetail | null;
  currentUserId: string;
  companyId: string;
};

/**
 * Shared loader for the Messages routes. Both /app/messages and
 * /app/messages/[threadId] render the same three-pane shell; only the selected
 * thread differs. A deep link to a thread the user can't see (RLS returns
 * nothing) bounces back to the index rather than throwing (interim IDOR guard,
 * mirroring Requests until the shared 403 boundary lands).
 */
export async function loadMessagesData(
  selectedThreadId: string | null,
): Promise<MessagesPageData> {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  const userId = session.user.id;
  const companyId = session.profile.company_id;

  const supabase = await createClient();
  const [threads, members, thread] = await Promise.all([
    listThreads(supabase, userId),
    companyId ? listCompanyMembers(supabase, companyId) : Promise.resolve([]),
    selectedThreadId
      ? getThreadDetail(supabase, selectedThreadId, userId)
      : Promise.resolve(null),
  ]);

  if (selectedThreadId && !thread) redirect("/app/messages");

  return {
    threads,
    members,
    thread,
    currentUserId: userId,
    companyId: companyId ?? "",
  };
}
