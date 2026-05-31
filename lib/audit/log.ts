import "server-only";
import { headers } from "next/headers";
import { createServiceClient } from "@/lib/supabase/service";
import type { Json } from "@/types/supabase";

/**
 * Canonical audit-log action keys. Every sensitive/super-admin mutation writes
 * one of these so the Audit Log viewer can filter on a stable, closed set
 * (audit CR-4). Keep the string values stable — they are persisted.
 */
export type AuditAction =
  | "impersonate_started"
  | "impersonate_ended"
  | "company_suspended"
  | "company_canceled"
  | "company_restored"
  | "invite_resent"
  | "invitation_send_failed"
  | "feature_flag_toggled"
  | "feature_flag_companies_updated"
  | "super_admin_note_created"
  | "super_admin_note_deleted"
  | "training_nudge_sent"
  | "deal_deleted"
  | "request_status_changed"
  | "request_deleted"
  | "coaching_nudge_sent"
  | "coaching_note_added"
  | "coaching_note_deleted"
  | "goal_set"
  | "goal_deleted"
  | "activity_back_dated"
  | "leaderboard_visibility_changed"
  | "message_deleted"
  | "message_thread_renamed"
  | "message_participant_added"
  | "message_participant_removed"
  | "message_thread_left";

export type AuditResourceType =
  | "company"
  | "user"
  | "feature_flag"
  | "note"
  | "deal"
  | "request"
  | "goal"
  | "activity_log"
  | "coaching_note"
  | "message"
  | "message_thread";

export type LogAuditInput = {
  actor_user_id: string;
  action: AuditAction;
  resource_type?: AuditResourceType;
  resource_id?: string | null;
  /** Free-form structured context, stored in audit_log.payload. */
  metadata?: Record<string, Json>;
};

/** Best-effort client IP from the standard proxy headers. */
function clientIp(h: Headers): string | null {
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim() || null;
  return h.get("x-real-ip");
}

/**
 * Append a row to `audit_log` using the service-role client. Captures the
 * request IP and user-agent automatically. Callers should pair this with their
 * mutation; see the admin actions for the transactional pattern.
 *
 * Audit logging must never break the surrounding action — failures here are
 * swallowed (and surfaced to the server console) rather than thrown.
 */
export async function logAudit(input: LogAuditInput): Promise<void> {
  try {
    const h = await headers();
    const service = createServiceClient();
    const { error } = await service.from("audit_log").insert({
      actor_user_id: input.actor_user_id,
      action: input.action,
      resource_type: input.resource_type ?? null,
      resource_id: input.resource_id ?? null,
      payload: (input.metadata ?? {}) as Json,
      ip_address: clientIp(h),
      user_agent: h.get("user-agent"),
    });
    if (error) {
      console.error("[audit] failed to write audit_log entry:", error.message);
    }
  } catch (err) {
    console.error("[audit] unexpected error writing audit_log entry:", err);
  }
}
