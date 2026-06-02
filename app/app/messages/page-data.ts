import "server-only";
import { redirect } from "next/navigation";

import { getSessionProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  getThreadDetail,
  listCompanyMembers,
  listThreads,
} from "@/lib/messages/queries";
import {
  listJoinedChannels,
  listVisibleChannels,
} from "@/lib/messages/channels";
import type {
  ChannelSummary,
  MemberLite,
  ThreadDetail,
  ThreadSummary,
} from "@/lib/messages/types";
import type { UserRole } from "@/lib/constants/roles";

const CHANNEL_ADMIN_ROLES: readonly UserRole[] = ["team_lead", "admin_tc"];

export type MessagesPageData = {
  threads: ThreadSummary[];
  channels: ChannelSummary[];
  members: MemberLite[];
  thread: ThreadDetail | null;
  currentUserId: string;
  companyId: string;
  canManageChannels: boolean;
};

/**
 * Shared loader for the Messages routes. The three-pane shell renders the same
 * for /app/messages, /app/messages/[threadId], and /app/messages/channels/[id];
 * only the selected thread differs (channels ARE threads, so getThreadDetail
 * resolves them too). A deep link to a thread/channel the user can't see (RLS
 * returns nothing) bounces back to the index (interim IDOR guard).
 */
export async function loadMessagesData(
  selectedThreadId: string | null,
): Promise<MessagesPageData> {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  const userId = session.user.id;
  const companyId = session.profile.company_id;

  const supabase = await createClient();
  const service = createServiceClient();
  const [threads, channels, members, thread] = await Promise.all([
    listThreads(supabase, userId),
    companyId
      ? listJoinedChannels(supabase, service, userId, companyId)
      : Promise.resolve([]),
    companyId ? listCompanyMembers(supabase, companyId) : Promise.resolve([]),
    selectedThreadId
      ? getThreadDetail(supabase, selectedThreadId, userId)
      : Promise.resolve(null),
  ]);

  if (selectedThreadId && !thread) redirect("/app/messages");

  return {
    threads,
    channels,
    members,
    thread,
    currentUserId: userId,
    companyId: companyId ?? "",
    canManageChannels: CHANNEL_ADMIN_ROLES.includes(session.profile.role),
  };
}

export type ChannelBrowseData = {
  channels: ChannelSummary[];
  members: MemberLite[];
  currentUserId: string;
  companyId: string;
  canManageChannels: boolean;
};

/** Loader for the channel browser (/app/messages/channels). */
export async function loadChannelBrowseData(): Promise<ChannelBrowseData> {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  const userId = session.user.id;
  const companyId = session.profile.company_id;
  if (!companyId) {
    return {
      channels: [],
      members: [],
      currentUserId: userId,
      companyId: "",
      canManageChannels: false,
    };
  }

  const supabase = await createClient();
  const service = createServiceClient();
  const [channels, members] = await Promise.all([
    listVisibleChannels(supabase, service, userId, companyId),
    listCompanyMembers(supabase, companyId),
  ]);

  return {
    channels,
    members,
    currentUserId: userId,
    companyId,
    canManageChannels: CHANNEL_ADMIN_ROLES.includes(session.profile.role),
  };
}
