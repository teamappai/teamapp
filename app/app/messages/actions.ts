"use server";

import { revalidatePath } from "next/cache";

import { getSessionProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { notify } from "@/lib/notifications/notify";
import { logAudit } from "@/lib/audit/log";
import type { DbClient } from "@/lib/storage";
import { EDIT_WINDOW_MS } from "@/lib/messages/constants";
import { extractMentionIds } from "@/lib/messages/mentions";
import { getOrCreateDirectThread } from "@/lib/messages/threads";
import {
  addParticipantsSchema,
  createThreadSchema,
  editMessageSchema,
  removeParticipantSchema,
  renameThreadSchema,
  sendMessageSchema,
  toggleReactionSchema,
  type AttachmentInput,
} from "@/lib/validations/messages";
import type { Json } from "@/types/supabase";

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

type Ctx = { userId: string; name: string | null; companyId: string | null };

async function ctx(): Promise<Ctx | null> {
  const session = await getSessionProfile();
  if (!session) return null;
  return {
    userId: session.user.id,
    name: session.profile.full_name,
    companyId: session.profile.company_id,
  };
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

/** Notify the other participants (and mentioned users) about a new message. */
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
  const { data: parts } = await client
    .from("message_thread_participants")
    .select("user_id")
    .eq("thread_id", args.threadId);
  const recipients = (parts ?? [])
    .map((p) => p.user_id)
    .filter((id) => id !== args.senderId);
  const mentioned = new Set(extractMentionIds(args.body));

  const payload: Record<string, Json> = {
    thread_id: args.threadId,
    message_id: args.messageId,
    sender_id: args.senderId,
    by_name: args.senderName ?? "",
  };

  await notify([
    ...recipients.map((userId) => ({
      userId,
      actorId: args.senderId,
      kind: "message_received" as const,
      payload,
    })),
    ...[...mentioned]
      .filter((id) => id !== args.senderId)
      .map((userId) => ({
        userId,
        actorId: args.senderId,
        kind: "message_mention" as const,
        payload,
      })),
  ]);
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
