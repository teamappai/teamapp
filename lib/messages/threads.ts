import "server-only";
import type { DbClient } from "@/lib/storage";

/**
 * Thread creation / lookup helpers shared by the messages server actions and
 * the coaching/training nudge integration (Decision 9). Each takes a Supabase
 * client so callers choose the auth context: the user client (RLS-scoped, the
 * caller is the thread creator and a participant) for interactive flows, or the
 * service client for system-generated nudges that post on a coach's behalf.
 */

/** Find an existing 1:1 DM thread between two users, or null. */
export async function findDirectThread(
  client: DbClient,
  userA: string,
  userB: string,
): Promise<string | null> {
  const directIdsFor = async (userId: string): Promise<Set<string>> => {
    const { data } = await client
      .from("message_thread_participants")
      .select("thread_id, message_threads!inner(type)")
      .eq("user_id", userId)
      .eq("message_threads.type", "direct");
    return new Set((data ?? []).map((r) => r.thread_id));
  };
  const [a, b] = await Promise.all([directIdsFor(userA), directIdsFor(userB)]);
  for (const id of a) if (b.has(id)) return id;
  return null;
}

/**
 * Find-or-create a 1:1 DM thread between two users in the same company.
 * `createdBy` becomes the thread owner (must equal auth.uid() under RLS, or use
 * the service client). Returns the thread id and whether it was just created.
 */
export async function getOrCreateDirectThread(
  client: DbClient,
  args: { companyId: string; createdBy: string; userA: string; userB: string },
): Promise<{ threadId: string; created: boolean } | null> {
  const existing = await findDirectThread(client, args.userA, args.userB);
  if (existing) return { threadId: existing, created: false };

  const { data: thread, error } = await client
    .from("message_threads")
    .insert({
      company_id: args.companyId,
      type: "direct",
      name: null,
      created_by: args.createdBy,
    })
    .select("id")
    .single();
  if (error || !thread) return null;

  const { error: pErr } = await client
    .from("message_thread_participants")
    .insert([
      { thread_id: thread.id, user_id: args.userA },
      { thread_id: thread.id, user_id: args.userB },
    ]);
  if (pErr) return null;
  return { threadId: thread.id, created: true };
}
