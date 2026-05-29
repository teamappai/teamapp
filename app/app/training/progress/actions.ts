"use server";

import { requireTeamLead } from "@/lib/auth/require-team-lead";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit/log";

export type NudgeResult = { ok: true } | { ok: false; error: string };

/**
 * Send an in-app training "nudge" to a stalled learner (PA-2). Writes a
 * `notifications` row only — real email/push follow-up is Phase 11/15. The
 * caller (team_lead/super_admin) is recorded as `actor_id`; RLS additionally
 * enforces that the recipient belongs to a company the caller manages.
 */
export async function sendNudge(input: {
  userId: string;
  sectionId: string;
  daysInactive: number;
  message: string;
}): Promise<NudgeResult> {
  const { user } = await requireTeamLead();

  const message = input.message.trim();
  if (!message) return { ok: false, error: "Message can't be empty." };

  const supabase = await createClient();
  const { error } = await supabase.from("notifications").insert({
    user_id: input.userId,
    actor_id: user.id,
    kind: "training_nudge",
    payload: {
      section_id: input.sectionId,
      days_inactive: input.daysInactive,
      custom_message: message,
    },
  });
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actor_user_id: user.id,
    action: "training_nudge_sent",
    resource_type: "user",
    resource_id: input.userId,
    metadata: {
      section_id: input.sectionId,
      days_inactive: input.daysInactive,
    },
  });

  return { ok: true };
}
