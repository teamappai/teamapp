"use server";

import { revalidatePath } from "next/cache";

import { getSessionProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { notify, type NotifyInput } from "@/lib/notifications/notify";
import { logAudit } from "@/lib/audit/log";
import type { DbClient } from "@/lib/storage";
import {
  EDIT_WINDOW_MS,
  isGeneralChannel,
  slugifyChannelName,
} from "@/lib/messages/constants";
import { extractMentionIds, hasChannelMention } from "@/lib/messages/mentions";
import { captureServer } from "@/lib/posthog/server";
import { getOrCreateDirectThread } from "@/lib/messages/threads";
import {
  channelMemberIds,
  getChannelRow,
  insertSystemMessage,
  isChannelMember,
} from "@/lib/messages/channels";
import { BUCKETS } from "@/lib/storage";
import type { UserRole } from "@/lib/constants/roles";
import {
  addParticipantsSchema,
  archiveChannelSchema,
  channelIdSchema,
  channelMemberSchema,
  channelMembersSchema,
  createChannelSchema,
  createThreadSchema,
  editMessageSchema,
  removeParticipantSchema,
  renameThreadSchema,
  sendMessageSchema,
  toggleReactionSchema,
  updateChannelSchema,
  type AttachmentInput,
} from "@/lib/validations/messages";
import type { Json } from "@/types/supabase";

/** Roles permitted to create and administer channels (Decision 2/4). */
const CHANNEL_ADMIN_ROLES: readonly UserRole[] = ["team_lead", "admin_tc"];

/**
 * Phase 11 Messages — server actions. Interactive writes use the RLS-scoped user
 * client (the caller is always the sender / thread creator, which RLS permits).
 * Cross-cutting writes that RLS deliberately restricts to the thread *creator*
 * — adding/removing other participants, renaming a group — go through the
 * service client with explicit participant/role checks, the same escape hatch
 * used by notify/audit.
 */

export type MessageActionResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

type Ctx = {
  userId: string;
  name: string | null;
  companyId: string | null;
  role: UserRole;
};

async function ctx(): Promise<Ctx | null> {
  const session = await getSessionProfile();
  if (!session) return null;
  return {
    userId: session.user.id,
    name: session.profile.full_name,
    companyId: session.profile.company_id,
    role: session.profile.role,
  };
}

function canManageChannels(role: UserRole): boolean {
  return CHANNEL_ADMIN_ROLES.includes(role);
}

// ── shared internals ──────────────────────────────────────────────────────────

async function insertMessage(
  client: DbClient,
  args: {
    threadId: string;
    senderId: string;
    body: string;
    attachments: AttachmentInput[];
    replyToMessageId: string | null;
  },
): Promise<{ id: string; createdAt: string } | null> {
  const body = args.body.trim();
  const { data, error } = await client
    .from("messages")
    .insert({
      thread_id: args.threadId,
      sender_id: args.senderId,
      body: body.length > 0 ? body : null,
      attachments: args.attachments as unknown as Json,
      reply_to_message_id: args.replyToMessageId,
    })
    .select("id, created_at")
    .single();
  if (error || !data) return null;
  return { id: data.id, createdAt: data.created_at };
}

/**
 * Notify about a new message. DMs/groups notify every other participant
 * ("message_received") plus any @mentioned user. Channels are noisier by nature,
 * so they DON'T blanket-notify members on every message — only @user mentions and
 * an @channel mention (Decision 9), which fans out to all members. The unread
 * badge (realtime) covers the rest.
 */
async function fanOut(
  client: DbClient,
  args: {
    threadId: string;
    messageId: string;
    senderId: string;
    senderName: string | null;
    body: string;
  },
): Promise<void> {
  const { data: thread } = await client
    .from("message_threads")
    .select("type")
    .eq("id", args.threadId)
    .maybeSingle();
  const isChannel = thread?.type === "channel";

  const { data: parts } = await client
    .from("message_thread_participants")
    .select("user_id")
    .eq("thread_id", args.threadId);
  const recipients = (parts ?? [])
    .map((p) => p.user_id)
    .filter((id) => id !== args.senderId);
  const mentioned = [...new Set(extractMentionIds(args.body))].filter(
    (id) => id !== args.senderId,
  );

  const payload: Record<string, Json> = {
    thread_id: args.threadId,
    message_id: args.messageId,
    sender_id: args.senderId,
    by_name: args.senderName ?? "",
  };

  const notifications: NotifyInput[] = [
    ...mentioned.map((userId) => ({
      userId,
      actorId: args.senderId,
      kind: "message_mention" as const,
      payload,
    })),
  ];

  if (isChannel) {
    if (hasChannelMention(args.body)) {
      // @channel → every member of THIS channel (Decision 9).
      notifications.push(
        ...recipients.map((userId) => ({
          userId,
          actorId: args.senderId,
          kind: "message_channel_mention" as const,
          payload,
        })),
      );
    }
  } else {
    notifications.push(
      ...recipients.map((userId) => ({
        userId,
        actorId: args.senderId,
        kind: "message_received" as const,
        payload,
      })),
    );
  }

  await notify(notifications);
}

// ── send ──────────────────────────────────────────────────────────────────────

export async function sendMessage(
  input: unknown,
): Promise<MessageActionResult<{ messageId: string; createdAt: string }>> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Your session has expired." };
  const parsed = sendMessageSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Couldn't send that.",
    };
  }
  const { threadId, body, attachments, replyToMessageId } = parsed.data;

  const supabase = await createClient();
  const created = await insertMessage(supabase, {
    threadId,
    senderId: c.userId,
    body,
    attachments,
    replyToMessageId,
  });
  if (!created) return { ok: false, error: "Could not send the message." };

  await fanOut(supabase, {
    threadId,
    messageId: created.id,
    senderId: c.userId,
    senderName: c.name,
    body,
  });

  // PostHog: mention_sent (channel engagement). One event per mention TYPE
  // present in the message — @channel broadcasts and @user pings are distinct
  // signals for the channels analysis.
  const groups = c.companyId ? { company: c.companyId } : undefined;
  if (hasChannelMention(body)) {
    await captureServer(
      "mention_sent",
      { mention_type: "@channel", channel_id: threadId },
      c.userId,
      groups,
    );
  }
  if (extractMentionIds(body).length > 0) {
    await captureServer(
      "mention_sent",
      { mention_type: "@user", channel_id: threadId },
      c.userId,
      groups,
    );
  }

  revalidatePath("/app/messages");
  return { ok: true, messageId: created.id, createdAt: created.createdAt };
}

// ── new thread (+ optional first message) ──────────────────────────────────────

export async function createThreadAndSend(
  input: unknown,
): Promise<MessageActionResult<{ threadId: string }>> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Your session has expired." };
  if (!c.companyId) return { ok: false, error: "No company context." };
  const parsed = createThreadSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Pick at least one person.",
    };
  }
  const others = [
    ...new Set(parsed.data.participantIds.filter((id) => id !== c.userId)),
  ];
  if (others.length === 0) {
    return { ok: false, error: "Pick someone other than yourself." };
  }

  const supabase = await createClient();

  // Thread + participant creation goes through the service client: the SELECT
  // RLS policy on message_threads keys on participation, so a creator can't read
  // back (RETURNING) a thread they aren't a participant of yet. We enforce the
  // company boundary explicitly here instead (same escape hatch as notify/audit).
  const service = createServiceClient();

  // Only allow adding teammates from the caller's own company.
  const { data: validMembers } = await service
    .from("users")
    .select("id")
    .in("id", others)
    .eq("company_id", c.companyId);
  const validIds = (validMembers ?? []).map((m) => m.id);
  if (validIds.length === 0) {
    return { ok: false, error: "Those people aren't on your team." };
  }

  let threadId: string;
  if (validIds.length === 1) {
    const dm = await getOrCreateDirectThread(service, {
      companyId: c.companyId,
      createdBy: c.userId,
      userA: c.userId,
      userB: validIds[0]!,
    });
    if (!dm) return { ok: false, error: "Could not start that conversation." };
    threadId = dm.threadId;
  } else {
    const { data: thread, error } = await service
      .from("message_threads")
      .insert({
        company_id: c.companyId,
        type: "group",
        name: parsed.data.name.trim() || null,
        created_by: c.userId,
      })
      .select("id")
      .single();
    if (error || !thread) {
      return { ok: false, error: "Could not create the group." };
    }
    const { error: pErr } = await service
      .from("message_thread_participants")
      .insert(
        [c.userId, ...validIds].map((user_id) => ({
          thread_id: thread.id,
          user_id,
        })),
      );
    if (pErr) return { ok: false, error: "Could not add participants." };
    threadId = thread.id;
  }

  const body = (parsed.data.body ?? "").trim();
  if (body.length > 0) {
    const created = await insertMessage(supabase, {
      threadId,
      senderId: c.userId,
      body,
      attachments: [],
      replyToMessageId: null,
    });
    if (created) {
      await fanOut(supabase, {
        threadId,
        messageId: created.id,
        senderId: c.userId,
        senderName: c.name,
        body,
      });
    }
  }

  revalidatePath("/app/messages");
  return { ok: true, threadId };
}

// ── read state (F-122) ─────────────────────────────────────────────────────────

export async function markThreadRead(
  threadId: string,
): Promise<MessageActionResult> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Your session has expired." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("message_thread_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("thread_id", threadId)
    .eq("user_id", c.userId);
  if (error) return { ok: false, error: "Could not update read state." };
  // Refresh the header badge (and any server-rendered list) for this user.
  revalidatePath("/app", "layout");
  return { ok: true };
}

// ── reactions ───────────────────────────────────────────────────────────────────

export async function toggleReaction(
  input: unknown,
): Promise<MessageActionResult<{ added: boolean }>> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Your session has expired." };
  const parsed = toggleReactionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid reaction." };
  const { messageId, emoji } = parsed.data;

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("message_reactions")
    .select("emoji")
    .eq("message_id", messageId)
    .eq("user_id", c.userId)
    .eq("emoji", emoji)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("message_reactions")
      .delete()
      .eq("message_id", messageId)
      .eq("user_id", c.userId)
      .eq("emoji", emoji);
    if (error) return { ok: false, error: "Could not remove the reaction." };
    return { ok: true, added: false };
  }

  const { error } = await supabase
    .from("message_reactions")
    .insert({ message_id: messageId, user_id: c.userId, emoji });
  if (error) return { ok: false, error: "Could not add the reaction." };
  return { ok: true, added: true };
}

// ── edit / delete (Decision 8) ──────────────────────────────────────────────────

export async function editMessage(
  input: unknown,
): Promise<MessageActionResult> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Your session has expired." };
  const parsed = editMessageSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Message can't be empty.",
    };
  }

  const supabase = await createClient();
  const { data: msg } = await supabase
    .from("messages")
    .select("id, sender_id, created_at, deleted_at")
    .eq("id", parsed.data.messageId)
    .maybeSingle();
  if (!msg) return { ok: false, error: "Message not found." };
  if (msg.sender_id !== c.userId) {
    return { ok: false, error: "You can only edit your own messages." };
  }
  if (msg.deleted_at) return { ok: false, error: "That message was deleted." };
  if (Date.now() - new Date(msg.created_at).getTime() > EDIT_WINDOW_MS) {
    return { ok: false, error: "The 5-minute edit window has passed." };
  }

  const { error } = await supabase
    .from("messages")
    .update({ body: parsed.data.body, edited_at: new Date().toISOString() })
    .eq("id", parsed.data.messageId);
  if (error) return { ok: false, error: "Could not edit the message." };

  revalidatePath("/app/messages");
  return { ok: true };
}

export async function deleteMessage(
  messageId: string,
): Promise<MessageActionResult> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Your session has expired." };
  const supabase = await createClient();
  const { data: msg } = await supabase
    .from("messages")
    .select("id, sender_id, thread_id")
    .eq("id", messageId)
    .maybeSingle();
  if (!msg) return { ok: false, error: "Message not found." };
  if (msg.sender_id !== c.userId) {
    return { ok: false, error: "You can only delete your own messages." };
  }

  const { error } = await supabase
    .from("messages")
    .update({
      deleted_at: new Date().toISOString(),
      body: null,
      attachments: [] as unknown as Json,
    })
    .eq("id", messageId);
  if (error) return { ok: false, error: "Could not delete the message." };

  await logAudit({
    actor_user_id: c.userId,
    action: "message_deleted",
    resource_type: "message",
    resource_id: messageId,
  });
  revalidatePath("/app/messages");
  return { ok: true };
}

// ── group management (Decision 10) ──────────────────────────────────────────────

/** True if `userId` participates in `threadId`. Uses the service client. */
async function isParticipant(
  service: ReturnType<typeof createServiceClient>,
  threadId: string,
  userId: string,
): Promise<boolean> {
  const { data } = await service
    .from("message_thread_participants")
    .select("user_id")
    .eq("thread_id", threadId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

export async function renameThread(
  input: unknown,
): Promise<MessageActionResult> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Your session has expired." };
  const parsed = renameThreadSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Name can't be empty.",
    };
  }
  const service = createServiceClient();
  const { data: thread } = await service
    .from("message_threads")
    .select("id, type")
    .eq("id", parsed.data.threadId)
    .maybeSingle();
  if (!thread) return { ok: false, error: "Conversation not found." };
  if (thread.type !== "group") {
    return { ok: false, error: "Only group names can be changed." };
  }
  if (!(await isParticipant(service, parsed.data.threadId, c.userId))) {
    return { ok: false, error: "You're not in that conversation." };
  }

  const { error } = await service
    .from("message_threads")
    .update({ name: parsed.data.name })
    .eq("id", parsed.data.threadId);
  if (error) return { ok: false, error: "Could not rename the group." };

  await logAudit({
    actor_user_id: c.userId,
    action: "message_thread_renamed",
    resource_type: "message_thread",
    resource_id: parsed.data.threadId,
  });
  revalidatePath("/app/messages");
  return { ok: true };
}

export async function addParticipants(
  input: unknown,
): Promise<MessageActionResult> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Your session has expired." };
  const parsed = addParticipantsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Pick someone to add." };

  const service = createServiceClient();
  const { data: thread } = await service
    .from("message_threads")
    .select("id, type, company_id")
    .eq("id", parsed.data.threadId)
    .maybeSingle();
  if (!thread) return { ok: false, error: "Conversation not found." };
  if (thread.type !== "group") {
    return { ok: false, error: "You can't add people to a direct message." };
  }
  if (!(await isParticipant(service, parsed.data.threadId, c.userId))) {
    return { ok: false, error: "You're not in that conversation." };
  }

  // Only add users from the same company.
  const { data: members } = await service
    .from("users")
    .select("id")
    .in("id", parsed.data.userIds)
    .eq("company_id", thread.company_id);
  const validIds = (members ?? []).map((m) => m.id);
  if (validIds.length === 0) {
    return { ok: false, error: "Those people aren't on your team." };
  }

  const { error } = await service.from("message_thread_participants").upsert(
    validIds.map((user_id) => ({
      thread_id: parsed.data.threadId,
      user_id,
    })),
    { onConflict: "thread_id,user_id", ignoreDuplicates: true },
  );
  if (error) return { ok: false, error: "Could not add participants." };

  await logAudit({
    actor_user_id: c.userId,
    action: "message_participant_added",
    resource_type: "message_thread",
    resource_id: parsed.data.threadId,
    metadata: { added: validIds } as Record<string, Json>,
  });
  revalidatePath("/app/messages");
  return { ok: true };
}

export async function removeParticipant(
  input: unknown,
): Promise<MessageActionResult> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Your session has expired." };
  const parsed = removeParticipantSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const service = createServiceClient();
  const { data: thread } = await service
    .from("message_threads")
    .select("id, type, created_by")
    .eq("id", parsed.data.threadId)
    .maybeSingle();
  if (!thread) return { ok: false, error: "Conversation not found." };
  if (thread.type !== "group") {
    return { ok: false, error: "You can't leave a direct message." };
  }

  const removingSelf = parsed.data.userId === c.userId;
  const isOwner = thread.created_by === c.userId;
  if (!removingSelf && !isOwner) {
    return { ok: false, error: "Only the group creator can remove others." };
  }
  if (!(await isParticipant(service, parsed.data.threadId, c.userId))) {
    return { ok: false, error: "You're not in that conversation." };
  }

  const { error } = await service
    .from("message_thread_participants")
    .delete()
    .eq("thread_id", parsed.data.threadId)
    .eq("user_id", parsed.data.userId);
  if (error) return { ok: false, error: "Could not update the group." };

  await logAudit({
    actor_user_id: c.userId,
    action: removingSelf
      ? "message_thread_left"
      : "message_participant_removed",
    resource_type: "message_thread",
    resource_id: parsed.data.threadId,
    metadata: { removed: parsed.data.userId } as Record<string, Json>,
  });
  revalidatePath("/app/messages");
  return { ok: true };
}

// ── channels (Phase 11.5) ───────────────────────────────────────────────────
//
// Channels are strictly within-company. Channel writes go through the service
// client (the RLS SELECT policy keys on participation, so a creator can't read
// back a channel they aren't yet in) with explicit company + role checks here.

const firstName = (name: string | null): string =>
  (name ?? "Someone").trim().split(/\s+/)[0] || "Someone";

export async function createChannel(
  input: unknown,
): Promise<MessageActionResult<{ channelId: string }>> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Your session has expired." };
  if (!c.companyId) return { ok: false, error: "No company context." };
  if (!canManageChannels(c.role)) {
    return {
      ok: false,
      error: "Only team leads and admins can create channels.",
    };
  }
  const parsed = createChannelSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Couldn't create the channel.",
    };
  }
  const name = slugifyChannelName(parsed.data.name);
  if (!name) return { ok: false, error: "Give your channel a valid name." };

  const service = createServiceClient();

  // Case-insensitive uniqueness within the company.
  const { data: existing } = await service
    .from("message_threads")
    .select("id, name")
    .eq("company_id", c.companyId)
    .eq("type", "channel");
  if ((existing ?? []).some((t) => (t.name ?? "").toLowerCase() === name)) {
    return { ok: false, error: `#${name} already exists.` };
  }

  const description = parsed.data.description.trim() || null;
  const { data: channel, error } = await service
    .from("message_threads")
    .insert({
      company_id: c.companyId,
      type: "channel",
      name,
      visibility: parsed.data.visibility,
      description,
      created_by: c.userId,
    })
    .select("id")
    .single();
  if (error || !channel) {
    return { ok: false, error: "Could not create the channel." };
  }

  // Creator + any selected members (validated to the same company).
  const others = [...new Set(parsed.data.memberIds)].filter(
    (id) => id !== c.userId,
  );
  let memberIds = [c.userId];
  if (others.length > 0) {
    const { data: valid } = await service
      .from("users")
      .select("id")
      .in("id", others)
      .eq("company_id", c.companyId);
    memberIds = [c.userId, ...(valid ?? []).map((m) => m.id)];
  }
  await service
    .from("message_thread_participants")
    .insert(memberIds.map((user_id) => ({ thread_id: channel.id, user_id })));

  await logAudit({
    actor_user_id: c.userId,
    action: "channel_created",
    resource_type: "message_thread",
    resource_id: channel.id,
    metadata: {
      name,
      visibility: parsed.data.visibility,
      members: memberIds.length,
    } as Record<string, Json>,
  });
  revalidatePath("/app/messages");
  return { ok: true, channelId: channel.id };
}

export async function joinChannel(
  input: unknown,
): Promise<MessageActionResult> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Your session has expired." };
  const parsed = channelIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid channel." };

  const service = createServiceClient();
  const channel = await getChannelRow(service, parsed.data.channelId);
  if (!channel) return { ok: false, error: "Channel not found." };
  if (channel.company_id !== c.companyId) {
    return { ok: false, error: "That channel isn't on your team." };
  }
  if (channel.visibility !== "public") {
    return { ok: false, error: "This channel is invite-only." };
  }
  if (await isChannelMember(service, channel.id, c.userId)) {
    return { ok: true };
  }

  const { error } = await service
    .from("message_thread_participants")
    .insert({ thread_id: channel.id, user_id: c.userId });
  if (error) return { ok: false, error: "Could not join the channel." };

  await insertSystemMessage(
    service,
    channel.id,
    `${firstName(c.name)} joined the channel`,
  );
  await captureServer(
    "channel_joined",
    {
      channel_id: channel.id,
      // Guarded above: only public channels are self-serve joinable.
      channel_type: "public",
      source: "browse",
    },
    c.userId,
    c.companyId ? { company: c.companyId } : undefined,
  );
  revalidatePath("/app/messages");
  return { ok: true };
}

export async function leaveChannel(
  input: unknown,
): Promise<MessageActionResult> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Your session has expired." };
  const parsed = channelIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid channel." };

  const service = createServiceClient();
  const channel = await getChannelRow(service, parsed.data.channelId);
  if (!channel) return { ok: false, error: "Channel not found." };
  if (isGeneralChannel(channel.name)) {
    return { ok: false, error: "You can't leave #general." };
  }
  if (!(await isChannelMember(service, channel.id, c.userId))) {
    return { ok: true };
  }

  const { error } = await service
    .from("message_thread_participants")
    .delete()
    .eq("thread_id", channel.id)
    .eq("user_id", c.userId);
  if (error) return { ok: false, error: "Could not leave the channel." };

  await insertSystemMessage(
    service,
    channel.id,
    `${firstName(c.name)} left the channel`,
  );
  revalidatePath("/app/messages");
  return { ok: true };
}

export async function updateChannel(
  input: unknown,
): Promise<MessageActionResult> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Your session has expired." };
  if (!canManageChannels(c.role)) {
    return {
      ok: false,
      error: "Only team leads and admins can edit channels.",
    };
  }
  const parsed = updateChannelSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Couldn't update the channel.",
    };
  }

  const service = createServiceClient();
  const channel = await getChannelRow(service, parsed.data.channelId);
  if (!channel) return { ok: false, error: "Channel not found." };
  if (channel.company_id !== c.companyId) {
    return { ok: false, error: "That channel isn't on your team." };
  }
  const general = isGeneralChannel(channel.name);

  const update: {
    name?: string;
    description?: string | null;
    visibility?: "public" | "private";
  } = {};

  if (parsed.data.name !== undefined) {
    const name = slugifyChannelName(parsed.data.name);
    if (!name) return { ok: false, error: "Give your channel a valid name." };
    if (general && name !== channel.name) {
      return { ok: false, error: "#general can't be renamed." };
    }
    if (name !== channel.name) {
      const { data: existing } = await service
        .from("message_threads")
        .select("id, name")
        .eq("company_id", c.companyId)
        .eq("type", "channel")
        .neq("id", channel.id);
      if ((existing ?? []).some((t) => (t.name ?? "").toLowerCase() === name)) {
        return { ok: false, error: `#${name} already exists.` };
      }
      update.name = name;
    }
  }

  // Description is always part of the edit form (empty clears it).
  update.description = parsed.data.description.trim() || null;

  if (parsed.data.visibility !== undefined) {
    if (general && parsed.data.visibility === "private") {
      return { ok: false, error: "#general can't be made private." };
    }
    update.visibility = parsed.data.visibility;
  }

  const { error } = await service
    .from("message_threads")
    .update(update)
    .eq("id", channel.id);
  if (error) return { ok: false, error: "Could not update the channel." };

  revalidatePath("/app/messages");
  return { ok: true };
}

export async function addChannelMembers(
  input: unknown,
): Promise<MessageActionResult> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Your session has expired." };
  if (!canManageChannels(c.role)) {
    return { ok: false, error: "Only team leads and admins can add members." };
  }
  const parsed = channelMembersSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Pick someone to add." };

  const service = createServiceClient();
  const channel = await getChannelRow(service, parsed.data.channelId);
  if (!channel) return { ok: false, error: "Channel not found." };
  if (channel.company_id !== c.companyId) {
    return { ok: false, error: "That channel isn't on your team." };
  }

  const { data: members } = await service
    .from("users")
    .select("id, full_name")
    .in("id", parsed.data.userIds)
    .eq("company_id", c.companyId);
  const existing = new Set(await channelMemberIds(service, channel.id));
  const toAdd = (members ?? []).filter((m) => !existing.has(m.id));
  if (toAdd.length === 0) return { ok: true };

  const { error } = await service
    .from("message_thread_participants")
    .insert(toAdd.map((m) => ({ thread_id: channel.id, user_id: m.id })));
  if (error) return { ok: false, error: "Could not add members." };

  for (const m of toAdd) {
    await insertSystemMessage(
      service,
      channel.id,
      `${firstName(m.full_name)} was added by ${firstName(c.name)}`,
    );
  }
  await logAudit({
    actor_user_id: c.userId,
    action: "channel_member_added",
    resource_type: "message_thread",
    resource_id: channel.id,
    metadata: { added: toAdd.map((m) => m.id) } as Record<string, Json>,
  });
  // PostHog: channel_joined via invite — one per added member (their identity).
  const channelType = channel.visibility === "private" ? "private" : "public";
  const groups = c.companyId ? { company: c.companyId } : undefined;
  for (const m of toAdd) {
    await captureServer(
      "channel_joined",
      { channel_id: channel.id, channel_type: channelType, source: "invite" },
      m.id,
      groups,
    );
  }
  revalidatePath("/app/messages");
  return { ok: true };
}

export async function removeChannelMember(
  input: unknown,
): Promise<MessageActionResult> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Your session has expired." };
  const parsed = channelMemberSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const service = createServiceClient();
  const channel = await getChannelRow(service, parsed.data.channelId);
  if (!channel) return { ok: false, error: "Channel not found." };
  if (channel.company_id !== c.companyId) {
    return { ok: false, error: "That channel isn't on your team." };
  }
  const removingSelf = parsed.data.userId === c.userId;
  if (!removingSelf && !canManageChannels(c.role)) {
    return {
      ok: false,
      error: "Only team leads and admins can remove members.",
    };
  }
  if (isGeneralChannel(channel.name)) {
    return { ok: false, error: "Members can't be removed from #general." };
  }

  const { data: target } = await service
    .from("users")
    .select("id, full_name")
    .eq("id", parsed.data.userId)
    .maybeSingle();

  const { error } = await service
    .from("message_thread_participants")
    .delete()
    .eq("thread_id", channel.id)
    .eq("user_id", parsed.data.userId);
  if (error) return { ok: false, error: "Could not remove the member." };

  await insertSystemMessage(
    service,
    channel.id,
    removingSelf
      ? `${firstName(c.name)} left the channel`
      : `${firstName(target?.full_name ?? null)} was removed by ${firstName(c.name)}`,
  );
  await logAudit({
    actor_user_id: c.userId,
    action: "channel_member_removed",
    resource_type: "message_thread",
    resource_id: channel.id,
    metadata: { removed: parsed.data.userId } as Record<string, Json>,
  });
  revalidatePath("/app/messages");
  return { ok: true };
}

/**
 * Hard-delete a channel (Decision 10 — "Archive" is the friendlier UI word, but
 * it permanently purges messages, reactions, participants, the thread row, and
 * every attachment in storage). #general is protected. Guarded by a typed
 * "ARCHIVE" confirmation in the schema.
 */
export async function archiveChannel(
  input: unknown,
): Promise<MessageActionResult> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Your session has expired." };
  if (!canManageChannels(c.role)) {
    return {
      ok: false,
      error: "Only team leads and admins can archive channels.",
    };
  }
  const parsed = archiveChannelSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Type "ARCHIVE" to confirm.' };
  }

  const service = createServiceClient();
  const channel = await getChannelRow(service, parsed.data.channelId);
  if (!channel) return { ok: false, error: "Channel not found." };
  if (channel.company_id !== c.companyId) {
    return { ok: false, error: "That channel isn't on your team." };
  }
  if (isGeneralChannel(channel.name)) {
    return { ok: false, error: "#general can't be archived." };
  }

  // Collect attachment storage paths before the cascade removes the messages.
  const { data: msgs } = await service
    .from("messages")
    .select("id, attachments")
    .eq("thread_id", channel.id);
  const messageCount = (msgs ?? []).length;
  const paths: string[] = [];
  for (const m of msgs ?? []) {
    const atts = Array.isArray(m.attachments) ? m.attachments : [];
    for (const a of atts as Array<{ path?: unknown }>) {
      if (a && typeof a.path === "string" && a.path) paths.push(a.path);
    }
  }
  if (paths.length > 0) {
    const { error: rmErr } = await service.storage
      .from(BUCKETS.messageAttachments)
      .remove(paths);
    if (rmErr) {
      console.error("[channels] attachment purge failed:", rmErr.message);
    }
  }

  // Deleting the thread cascades messages → reactions/replies and participants
  // (on delete cascade in the Phase 1 schema).
  const { error } = await service
    .from("message_threads")
    .delete()
    .eq("id", channel.id);
  if (error) return { ok: false, error: "Could not archive the channel." };

  await logAudit({
    actor_user_id: c.userId,
    action: "channel_archived",
    resource_type: "message_thread",
    resource_id: channel.id,
    metadata: {
      name: channel.name,
      message_count: messageCount,
    } as Record<string, Json>,
  });
  revalidatePath("/app/messages");
  return { ok: true };
}
