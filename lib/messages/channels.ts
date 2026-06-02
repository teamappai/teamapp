import "server-only";
import type { DbClient } from "@/lib/storage";
import { isGeneralChannel } from "@/lib/messages/constants";
import { getUnreadSummary } from "@/lib/messages/queries";
import type { ChannelSummary, ChannelVisibility } from "@/lib/messages/types";

/**
 * Phase 11.5 Channels — reads + server-action helpers. Channels are
 * message_threads of type='channel', scoped to ONE company. Browse/list reads go
 * through the RLS-scoped user client (public channels in my company + private
 * channels I belong to are visible; everything else is invisible). Mutations that
 * RLS deliberately restricts (creating channels, adding/removing other members,
 * posting system notices with a NULL sender) go through the service client with
 * explicit company/role checks — the same escape hatch used across messaging.
 */

// ── browse / sidebar reads (RLS-scoped) ───────────────────────────────────────

/**
 * Every channel in the company that the caller can see: all public channels plus
 * any private channel they belong to. The VISIBLE SET is decided by the RLS
 * client (`client`) — this is what enforces the company + public/private
 * boundary. Member counts and last-activity are then enriched with the SERVICE
 * client (`service`), because RLS hides a channel's participant/message rows from
 * non-members — so a public channel a user hasn't joined would otherwise show
 * "0 members". Enrichment is safe: it only runs for channels RLS already cleared.
 */
export async function listVisibleChannels(
  client: DbClient,
  service: DbClient,
  userId: string,
  companyId: string,
): Promise<ChannelSummary[]> {
  const { data: channels } = await client
    .from("message_threads")
    .select("id, name, description, visibility, updated_at")
    .eq("company_id", companyId)
    .eq("type", "channel");
  if (!channels || channels.length === 0) return [];

  const ids = channels.map((c) => c.id);

  // Member counts (+ my membership) for the visible set — service-scoped so
  // non-member public-channel counts are accurate.
  const { data: parts } = await service
    .from("message_thread_participants")
    .select("thread_id, user_id")
    .in("thread_id", ids);
  const memberCount = new Map<string, number>();
  const myChannels = new Set<string>();
  for (const p of parts ?? []) {
    memberCount.set(p.thread_id, (memberCount.get(p.thread_id) ?? 0) + 1);
    if (p.user_id === userId) myChannels.add(p.thread_id);
  }

  // Last message time per channel (for sort + "last activity"). Newest first, so
  // the first row seen for a thread wins.
  const { data: msgs } = await service
    .from("messages")
    .select("thread_id, created_at")
    .in("thread_id", ids)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  const lastActivity = new Map<string, string>();
  for (const m of msgs ?? []) {
    if (!lastActivity.has(m.thread_id))
      lastActivity.set(m.thread_id, m.created_at);
  }

  const unread = await getUnreadSummary(client, userId);

  return channels
    .map((c): ChannelSummary => {
      const isMember = myChannels.has(c.id);
      return {
        id: c.id,
        name: c.name ?? "channel",
        description: c.description,
        visibility: (c.visibility as ChannelVisibility | null) ?? "public",
        isGeneral: isGeneralChannel(c.name),
        memberCount: memberCount.get(c.id) ?? 0,
        isMember,
        unreadCount: isMember ? (unread.perThread[c.id] ?? 0) : 0,
        lastActivityAt: lastActivity.get(c.id) ?? c.updated_at,
      };
    })
    .sort(byChannelOrder);
}

/** #general first, then joined channels, then the rest — all alphabetical. */
function byChannelOrder(a: ChannelSummary, b: ChannelSummary): number {
  if (a.isGeneral !== b.isGeneral) return a.isGeneral ? -1 : 1;
  if (a.isMember !== b.isMember) return a.isMember ? -1 : 1;
  return a.name.localeCompare(b.name);
}

/** Joined channels only, for the left-rail "Channels" section. */
export async function listJoinedChannels(
  client: DbClient,
  service: DbClient,
  userId: string,
  companyId: string,
): Promise<ChannelSummary[]> {
  const all = await listVisibleChannels(client, service, userId, companyId);
  return all.filter((c) => c.isMember);
}

// ── server-action helpers (service client) ────────────────────────────────────

export type ChannelRow = {
  id: string;
  type: string;
  company_id: string;
  name: string | null;
  visibility: string | null;
  description: string | null;
  created_by: string | null;
};

/** Load a channel by id (service client; caller checks company/role). */
export async function getChannelRow(
  service: DbClient,
  channelId: string,
): Promise<ChannelRow | null> {
  const { data } = await service
    .from("message_threads")
    .select("id, type, company_id, name, visibility, description, created_by")
    .eq("id", channelId)
    .maybeSingle();
  if (!data || data.type !== "channel") return null;
  return data as ChannelRow;
}

export async function isChannelMember(
  service: DbClient,
  channelId: string,
  userId: string,
): Promise<boolean> {
  const { data } = await service
    .from("message_thread_participants")
    .select("user_id")
    .eq("thread_id", channelId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

export async function channelMemberIds(
  service: DbClient,
  channelId: string,
): Promise<string[]> {
  const { data } = await service
    .from("message_thread_participants")
    .select("user_id")
    .eq("thread_id", channelId);
  return (data ?? []).map((p) => p.user_id);
}

/**
 * Post a system notice into a channel (Decision 6): sender_id NULL, is_system
 * true. Best-effort — a failed notice never blocks the surrounding mutation.
 */
export async function insertSystemMessage(
  service: DbClient,
  channelId: string,
  body: string,
): Promise<void> {
  const { error } = await service.from("messages").insert({
    thread_id: channelId,
    sender_id: null,
    is_system: true,
    body,
  });
  if (error) {
    console.error("[channels] system message failed:", error.message);
  }
}

/** Find a company's #general channel id (service client). */
export async function findGeneralChannelId(
  service: DbClient,
  companyId: string,
): Promise<string | null> {
  const { data } = await service
    .from("message_threads")
    .select("id, name")
    .eq("company_id", companyId)
    .eq("type", "channel");
  const general = (data ?? []).find((t) => isGeneralChannel(t.name));
  return general?.id ?? null;
}

/**
 * Add a user to their company's #general channel (Decision 3: new users
 * auto-join #general). Idempotent. Used by the invite-accept flow. Best-effort.
 */
export async function addUserToGeneralChannel(
  service: DbClient,
  companyId: string,
  userId: string,
): Promise<void> {
  const generalId = await findGeneralChannelId(service, companyId);
  if (!generalId) return;
  const { error } = await service
    .from("message_thread_participants")
    .upsert(
      { thread_id: generalId, user_id: userId },
      { onConflict: "thread_id,user_id", ignoreDuplicates: true },
    );
  if (error) {
    console.error("[channels] #general auto-join failed:", error.message);
  }
}
