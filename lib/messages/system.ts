import "server-only";
import type { DbClient } from "@/lib/storage";
import type { Json } from "@/types/supabase";
import { getOrCreateDirectThread } from "@/lib/messages/threads";

/**
 * Nudge integration (Decision 9). A coaching/training "nudge" now posts a real
 * chat message into the DM thread between the coach and the agent (creating the
 * thread on first nudge) and tags it with an origin so the UI can badge it.
 * Pass the SERVICE client — the message is sent on the coach's behalf and the
 * thread may need creating across the RLS participant-insert boundary.
 */
export async function sendNudgeMessage(
  service: DbClient,
  args: {
    companyId: string;
    fromUserId: string;
    toUserId: string;
    contextType: "coaching_nudge" | "training_nudge";
    contextPayload: Record<string, Json>;
    body: string;
  },
): Promise<{ threadId: string; messageId: string } | null> {
  const dm = await getOrCreateDirectThread(service, {
    companyId: args.companyId,
    createdBy: args.fromUserId,
    userA: args.fromUserId,
    userB: args.toUserId,
  });
  if (!dm) return null;

  const { data, error } = await service
    .from("messages")
    .insert({
      thread_id: dm.threadId,
      sender_id: args.fromUserId,
      body: args.body,
      context_type: args.contextType,
      context_payload: args.contextPayload as Json,
    })
    .select("id")
    .single();
  if (error || !data) return null;
  return { threadId: dm.threadId, messageId: data.id };
}
