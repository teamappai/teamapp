import "server-only";
import type { DbClient } from "@/lib/storage";
import { BUCKETS } from "@/lib/storage";
import type { UserRole } from "@/lib/constants/roles";
import { autoGroupName } from "@/lib/messages/constants";
import type {
  MemberLite,
  MessageAttachment,
  MessageView,
  ParticipantView,
  ReactionGroup,
  SignedAttachment,
  ThreadDetail,
  ThreadSummary,
  ThreadType,
  UnreadSummary,
} from "@/lib/messages/types";

/**
 * Server-side reads for Messages. The unread math lives in ONE place
 * (`getUnreadSummary`) so the header badge and the per-thread list badges can
 * never disagree (fixes F-122). Everything here is RLS-scoped through the passed
 * client — a non-participant simply sees nothing.
 */

const SIGNED_URL_TTL = 60 * 60; // 1 hour

// ── members ───────────────────────────────────────────────────────────────────

/** Fetch a batch of users as MemberLite, keyed by id. */
async function fetchMembers(
  client: DbClient,
  userIds: string[],
): Promise<Map<string, MemberLite>> {
  const map = new Map<string, MemberLite>();
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return map;
  const { data } = await client
    .from("users")
    .select("id, full_name, avatar_url, role")
    .in("id", ids);
  for (const u of data ?? []) {
    map.set(u.id, {
      id: u.id,
      name: u.full_name,
      avatarUrl: u.avatar_url,
      role: u.role as UserRole,
    });
  }
  return map;
}

/** All active members of a company (for pickers + mention resolution). */
export async function listCompanyMembers(
  client: DbClient,
  companyId: string,
): Promise<MemberLite[]> {
  const { data } = await client
    .from("users")
    .select("id, full_name, avatar_url, role")
    .eq("company_id", companyId)
    .eq("status", "active")
    .order("full_name", { ascending: true });
  return (data ?? []).map((u) => ({
    id: u.id,
    name: u.full_name,
    avatarUrl: u.avatar_url,
    role: u.role as UserRole,
  }));
}

// ── unread (single source of truth — F-122) ───────────────────────────────────

export async function getUnreadSummary(
  client: DbClient,
  userId: string,
): Promise<UnreadSummary> {
  // My memberships, with the thread type so channel threads are excluded from
  // the count (Phase 11 does not surface channels anywhere).
  const { data: parts } = await client
    .from("message_thread_participants")
    .select("thread_id, last_read_at, message_threads!inner(type)")
    .eq("user_id", userId);

  const rows = (parts ?? []).filter(
    (p) => (p.message_threads as { type: ThreadType }).type !== "channel",
  );

  const counts = await Promise.all(
    rows.map(async (p) => {
      let q = client
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("thread_id", p.thread_id)
        .neq("sender_id", userId)
        .is("deleted_at", null);
      if (p.last_read_at) q = q.gt("created_at", p.last_read_at);
      const { count } = await q;
      return [p.thread_id, count ?? 0] as const;
    }),
  );

  const perThread: Record<string, number> = {};
  let total = 0;
  for (const [tid, c] of counts) {
    perThread[tid] = c;
    total += c; // header badge == sum of the per-thread list badges (F-122)
  }
  return { total, perThread };
}

// ── thread list (left rail) ────────────────────────────────────────────────────

function resolveThreadName(
  type: ThreadType,
  customName: string | null,
  others: MemberLite[],
): string {
  if (type === "direct") return others[0]?.name ?? "Direct message";
  if (customName && customName.trim()) return customName.trim();
  return autoGroupName(others.map((m) => m.name));
}

export async function listThreads(
  client: DbClient,
  userId: string,
): Promise<ThreadSummary[]> {
  const { data: myParts } = await client
    .from("message_thread_participants")
    .select("thread_id")
    .eq("user_id", userId);
  const threadIds = (myParts ?? []).map((p) => p.thread_id);
  if (threadIds.length === 0) return [];

  const { data: threads } = await client
    .from("message_threads")
    .select("id, type, name, created_by, updated_at")
    .in("id", threadIds)
    .neq("type", "channel");
  if (!threads || threads.length === 0) return [];

  // All participants across these threads, with member detail.
  const { data: allParts } = await client
    .from("message_thread_participants")
    .select("thread_id, user_id")
    .in(
      "thread_id",
      threads.map((t) => t.id),
    );
  const members = await fetchMembers(
    client,
    (allParts ?? []).map((p) => p.user_id),
  );
  const byThread = new Map<string, MemberLite[]>();
  for (const p of allParts ?? []) {
    const m = members.get(p.user_id);
    if (!m) continue;
    const arr = byThread.get(p.thread_id) ?? [];
    arr.push(m);
    byThread.set(p.thread_id, arr);
  }

  const unread = await getUnreadSummary(client, userId);

  const summaries = await Promise.all(
    threads.map(async (t): Promise<ThreadSummary> => {
      const participants = byThread.get(t.id) ?? [];
      const others = participants.filter((m) => m.id !== userId);

      const { data: last } = await client
        .from("messages")
        .select("body, sender_id, created_at, deleted_at")
        .eq("thread_id", t.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return {
        id: t.id,
        type: t.type as ThreadType,
        name: resolveThreadName(t.type as ThreadType, t.name, others),
        participants,
        lastMessage: last
          ? {
              body: last.deleted_at ? null : last.body,
              senderName: members.get(last.sender_id ?? "")?.name ?? null,
              createdAt: last.created_at,
              deleted: last.deleted_at !== null,
            }
          : null,
        unreadCount: unread.perThread[t.id] ?? 0,
        updatedAt: t.updated_at,
      };
    }),
  );

  // Most-recent activity first (last message time, falling back to updated_at).
  summaries.sort((a, b) => {
    const at = a.lastMessage?.createdAt ?? a.updatedAt;
    const bt = b.lastMessage?.createdAt ?? b.updatedAt;
    return bt.localeCompare(at);
  });
  return summaries;
}

// ── thread detail (center + right) ─────────────────────────────────────────────

async function signAttachments(
  client: DbClient,
  raw: MessageAttachment[],
): Promise<SignedAttachment[]> {
  if (raw.length === 0) return [];
  const { data } = await client.storage
    .from(BUCKETS.messageAttachments)
    .createSignedUrls(
      raw.map((a) => a.path),
      SIGNED_URL_TTL,
    );
  const urlByPath = new Map(
    (data ?? []).map((d) => [d.path ?? "", d.signedUrl]),
  );
  return raw.map((a) => ({ ...a, url: urlByPath.get(a.path) ?? "" }));
}

function parseAttachments(value: unknown): MessageAttachment[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((a): a is Record<string, unknown> => !!a && typeof a === "object")
    .map((a) => ({
      path: String(a.path ?? ""),
      name: String(a.name ?? "file"),
      size: typeof a.size === "number" ? a.size : null,
      contentType: typeof a.contentType === "string" ? a.contentType : null,
    }))
    .filter((a) => a.path.length > 0);
}

export async function getThreadDetail(
  client: DbClient,
  threadId: string,
  userId: string,
): Promise<ThreadDetail | null> {
  const { data: thread } = await client
    .from("message_threads")
    .select("id, type, name, created_by")
    .eq("id", threadId)
    .maybeSingle();
  if (!thread) return null; // not a participant (RLS) or missing

  const { data: partRows } = await client
    .from("message_thread_participants")
    .select("user_id, last_read_at")
    .eq("thread_id", threadId);
  const members = await fetchMembers(
    client,
    (partRows ?? []).map((p) => p.user_id),
  );
  const participants: ParticipantView[] = (partRows ?? [])
    .map((p) => {
      const m = members.get(p.user_id);
      if (!m) return null;
      return {
        ...m,
        lastReadAt: p.last_read_at,
        isCreator: p.user_id === thread.created_by,
      };
    })
    .filter((p): p is ParticipantView => p !== null);

  const { data: msgRows } = await client
    .from("messages")
    .select(
      "id, thread_id, sender_id, body, attachments, reply_to_message_id, edited_at, deleted_at, created_at, context_type, context_payload",
    )
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  const rows = msgRows ?? [];

  // Reactions for all messages in this thread, with reactor names.
  const reactionsByMessage = new Map<string, ReactionGroup[]>();
  if (rows.length > 0) {
    const { data: reactRows } = await client
      .from("message_reactions")
      .select("message_id, user_id, emoji, users(full_name)")
      .in(
        "message_id",
        rows.map((r) => r.id),
      );
    const grouped = new Map<string, Map<string, ReactionGroup>>();
    for (const r of reactRows ?? []) {
      const byEmoji = grouped.get(r.message_id) ?? new Map();
      const g = byEmoji.get(r.emoji) ?? {
        emoji: r.emoji,
        count: 0,
        reactors: [],
        mine: false,
      };
      g.count += 1;
      const reactorName =
        (r.users as { full_name: string | null } | null)?.full_name ??
        members.get(r.user_id)?.name ??
        "Someone";
      g.reactors.push(reactorName);
      if (r.user_id === userId) g.mine = true;
      byEmoji.set(r.emoji, g);
      grouped.set(r.message_id, byEmoji);
    }
    for (const [mid, byEmoji] of grouped) {
      reactionsByMessage.set(mid, [...byEmoji.values()]);
    }
  }

  // Sign every attachment across the thread in one batched call.
  const attachmentsByMessage = new Map<string, MessageAttachment[]>();
  const allRaw: MessageAttachment[] = [];
  for (const r of rows) {
    if (r.deleted_at) continue;
    const parsed = parseAttachments(r.attachments);
    if (parsed.length) {
      attachmentsByMessage.set(r.id, parsed);
      allRaw.push(...parsed);
    }
  }
  const signedAll = await signAttachments(client, allRaw);
  const urlByPath = new Map(signedAll.map((a) => [a.path, a.url]));
  const sign = (a: MessageAttachment): SignedAttachment => ({
    ...a,
    url: urlByPath.get(a.path) ?? "",
  });

  const messages: MessageView[] = rows.map((r) => {
    const sender = r.sender_id ? members.get(r.sender_id) : null;
    return {
      id: r.id,
      threadId: r.thread_id,
      senderId: r.sender_id,
      senderName: sender?.name ?? null,
      senderAvatarUrl: sender?.avatarUrl ?? null,
      senderRole: sender?.role ?? null,
      body: r.deleted_at ? null : r.body,
      attachments: r.deleted_at
        ? []
        : (attachmentsByMessage.get(r.id) ?? []).map(sign),
      replyToMessageId: r.reply_to_message_id,
      editedAt: r.edited_at,
      deletedAt: r.deleted_at,
      createdAt: r.created_at,
      contextType: r.context_type,
      contextPayload:
        (r.context_payload as Record<string, unknown> | null) ?? null,
      reactions: reactionsByMessage.get(r.id) ?? [],
    };
  });

  const others = participants.filter((p) => p.id !== userId);
  const files = messages.flatMap((m) =>
    m.attachments.map((a) => ({
      ...a,
      messageId: m.id,
      uploadedAt: m.createdAt,
    })),
  );

  return {
    id: thread.id,
    type: thread.type as ThreadType,
    name: resolveThreadName(thread.type as ThreadType, thread.name, others),
    customName: thread.name,
    createdBy: thread.created_by,
    participants,
    messages,
    files,
  };
}
