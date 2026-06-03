import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import type { CoachingReply } from "@/lib/dashboards/drill-down";

/**
 * Fetch replies for a set of coaching-note ids, grouped by note id, with author
 * identity resolved. Uses the service client; callers MUST gate visibility
 * (admin_tc never sees reply threads — Decision 3).
 */
export async function getRepliesForEntries(
  entryIds: string[],
): Promise<Record<string, CoachingReply[]>> {
  const out: Record<string, CoachingReply[]> = {};
  if (entryIds.length === 0) return out;

  const service = createServiceClient();
  const { data: replies } = await service
    .from("coaching_log_replies")
    .select("id, coaching_log_entry_id, body, author_user_id, created_at")
    .in("coaching_log_entry_id", entryIds)
    .order("created_at", { ascending: true });

  const rows = (replies ?? []) as {
    id: string;
    coaching_log_entry_id: string;
    body: string;
    author_user_id: string;
    created_at: string;
  }[];
  if (rows.length === 0) return out;

  const authorIds = [...new Set(rows.map((r) => r.author_user_id))];
  const { data: users } = await service
    .from("users")
    .select("id, full_name, avatar_url")
    .in("id", authorIds);
  const nameMap = new Map(
    (
      (users ?? []) as {
        id: string;
        full_name: string | null;
        avatar_url: string | null;
      }[]
    ).map((u) => [u.id, u]),
  );

  for (const r of rows) {
    const author = nameMap.get(r.author_user_id);
    (out[r.coaching_log_entry_id] ??= []).push({
      id: r.id,
      body: r.body,
      authorId: r.author_user_id,
      authorName: author?.full_name ?? null,
      authorAvatar: author?.avatar_url ?? null,
      createdAt: r.created_at,
    });
  }
  return out;
}
