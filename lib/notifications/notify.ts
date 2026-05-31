import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import type { Json } from "@/types/supabase";

/**
 * In-app notification fan-out (audit PA-2). Writes to public.notifications with
 * the SERVICE-ROLE client because the RLS insert policy only lets a user create
 * notifications for THEMSELVES (or as a manager) — but most notifications are
 * created for the OTHER party (notify the assignee/creator). System-generated
 * notifications therefore bypass RLS, exactly like lib/audit/log.ts.
 *
 * Email delivery (Resend) is deferred to Phase 11; for now this is the bell
 * badge's only source.
 */

export type NotificationKind =
  | "request_ready_for_review"
  | "request_completed"
  | "request_new_comment"
  | "request_assigned"
  | "coaching_nudge"
  | "training_nudge"
  | "message_received"
  | "message_mention";

export type NotifyInput = {
  /** Recipient. */
  userId: string;
  /** Who triggered it (the actor); omitted/null for system events. */
  actorId?: string | null;
  kind: NotificationKind;
  payload?: Record<string, Json>;
};

/**
 * Insert one or more notifications. Recipients equal to the actor are dropped
 * (never notify yourself about your own action), as are duplicate recipients.
 * Best-effort: failures are logged, never thrown, so they can't break the
 * surrounding mutation.
 */
export async function notify(inputs: NotifyInput[]): Promise<void> {
  const rows = inputs
    .filter((n) => n.userId && n.userId !== n.actorId)
    .filter(
      (n, i, arr) =>
        arr.findIndex((o) => o.userId === n.userId && o.kind === n.kind) === i,
    )
    .map((n) => ({
      user_id: n.userId,
      actor_id: n.actorId ?? null,
      kind: n.kind,
      payload: (n.payload ?? {}) as Json,
    }));
  if (rows.length === 0) return;

  try {
    const service = createServiceClient();
    const { error } = await service.from("notifications").insert(rows);
    if (error) {
      console.error("[notify] failed to insert notifications:", error.message);
    }
  } catch (err) {
    console.error("[notify] unexpected error:", err);
  }
}
