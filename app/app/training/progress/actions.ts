"use server";

import { revalidatePath } from "next/cache";

import { requireTeamLead } from "@/lib/auth/require-team-lead";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit/log";
import { notify } from "@/lib/notifications/notify";
import { sendNudgeMessage } from "@/lib/messages/system";

export type NudgeResult = { ok: true } | { ok: false; error: string };

/**
 * Send a training "nudge" to a stalled learner (PA-2). Decision 9: this now
 * posts a real chat message into the lead↔learner DM (tagged as a training
 * nudge) instead of only writing a notifications row, and fires both the
 * training-nudge and message-received notifications. The caller
 * (team_lead/super_admin) is recorded as the sender/actor.
 */
export async function sendNudge(input: {
  userId: string;
  sectionId: string;
  daysInactive: number;
  message: string;
}): Promise<NudgeResult> {
  const { user, companyId: leadCompanyId } = await requireTeamLead();

  const message = input.message.trim();
  if (!message) return { ok: false, error: "Message can't be empty." };

  const service = createServiceClient();

  // The DM lives in the learner's company (a super_admin lead has none).
  let companyId = leadCompanyId;
  if (!companyId) {
    const { data: learner } = await service
      .from("users")
      .select("company_id")
      .eq("id", input.userId)
      .single();
    companyId = learner?.company_id ?? null;
  }
  if (!companyId) return { ok: false, error: "No company context." };

  const sent = await sendNudgeMessage(service, {
    companyId,
    fromUserId: user.id,
    toUserId: input.userId,
    contextType: "training_nudge",
    contextPayload: {
      section_id: input.sectionId,
      days_inactive: input.daysInactive,
      custom_message: message,
    },
    body: `📚 ${message}`,
  });

  await notify([
    {
      userId: input.userId,
      actorId: user.id,
      kind: "training_nudge",
      payload: {
        section_id: input.sectionId,
        days_inactive: input.daysInactive,
        custom_message: message,
        ...(sent
          ? { thread_id: sent.threadId, message_id: sent.messageId }
          : {}),
      },
    },
    ...(sent
      ? [
          {
            userId: input.userId,
            actorId: user.id,
            kind: "message_received" as const,
            payload: {
              thread_id: sent.threadId,
              message_id: sent.messageId,
              sender_id: user.id,
            },
          },
        ]
      : []),
  ]);

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

  revalidatePath("/app/messages");
  return { ok: true };
}
