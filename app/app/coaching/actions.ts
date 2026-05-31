"use server";

import { revalidatePath } from "next/cache";
import { getSessionProfile } from "@/lib/auth/profile";
import { createServiceClient } from "@/lib/supabase/service";
import { isCoachRole, canDeleteCoachingNote } from "@/lib/coaching/access";
import {
  coachingNoteSchema,
  nudgeSchema,
  goalUpsertSchema,
} from "@/lib/validations/coaching";
import { notify } from "@/lib/notifications/notify";
import { logAudit } from "@/lib/audit/log";
import { sendNudgeMessage } from "@/lib/messages/system";
import type { UserRole } from "@/lib/constants/roles";

const NUDGE_REASON_TEXT: Record<string, string> = {
  stalled_activity: "I noticed your activity has stalled this week.",
  below_goal_pace: "You're tracking a bit below your goal pace.",
  stalled_training:
    "Looks like your training has stalled — let's keep it going.",
  custom: "Checking in.",
};

/**
 * Coaching mutations. Notes/nudges/cross-agent goals require coach privileges
 * (team_lead / super_admin / admin_tc — admin_tc has parity here). Because RLS's
 * `can_manage_company` intentionally excludes admin_tc, these writes go through
 * the service-role client with explicit same-company authorization checks
 * (same pattern as notify/audit). Agents may set/edit their OWN goals.
 */

export type CoachingResult = { ok: true } | { ok: false; error: string };

type Ctx = { userId: string; role: UserRole; companyId: string | null };

async function ctx(): Promise<Ctx | null> {
  const session = await getSessionProfile();
  if (!session) return null;
  return {
    userId: session.user.id,
    role: session.profile.role,
    companyId: session.profile.company_id,
  };
}

/** True if `targetUserId` is a member of the caller's company (or caller is SA). */
async function sameCompany(c: Ctx, targetUserId: string): Promise<boolean> {
  if (c.role === "super_admin") return true;
  if (!c.companyId) return false;
  const service = createServiceClient();
  const { data } = await service
    .from("users")
    .select("company_id")
    .eq("id", targetUserId)
    .single();
  return data?.company_id === c.companyId;
}

// ── Coaching notes ──────────────────────────────────────────────────────────────

export async function addCoachingNote(input: unknown): Promise<CoachingResult> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Your session has expired." };
  if (!isCoachRole(c.role)) {
    return { ok: false, error: "You can't add coaching notes." };
  }
  const parsed = coachingNoteSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Write a note first.",
    };
  }
  if (!(await sameCompany(c, parsed.data.agentUserId))) {
    return { ok: false, error: "That agent isn't on your team." };
  }

  const service = createServiceClient();
  const { error } = await service.from("coaching_log_entries").insert({
    agent_user_id: parsed.data.agentUserId,
    coach_user_id: c.userId,
    body: parsed.data.body,
    occurred_at: new Date().toISOString(),
    is_test: false,
  });
  if (error) return { ok: false, error: "Could not save the note." };

  await logAudit({
    actor_user_id: c.userId,
    action: "coaching_note_added",
    resource_type: "coaching_note",
    resource_id: parsed.data.agentUserId,
  });
  revalidatePath("/app/coaching");
  return { ok: true };
}

export async function deleteCoachingNote(id: string): Promise<CoachingResult> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Your session has expired." };
  if (!canDeleteCoachingNote(c.role)) {
    return { ok: false, error: "You can't delete coaching notes." };
  }
  const service = createServiceClient();
  const { data: entry } = await service
    .from("coaching_log_entries")
    .select("id, agent_user_id")
    .eq("id", id)
    .single();
  if (!entry) return { ok: false, error: "Note not found." };
  if (!(await sameCompany(c, entry.agent_user_id))) {
    return { ok: false, error: "That note isn't on your team." };
  }

  const { error } = await service
    .from("coaching_log_entries")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: "Could not delete the note." };

  await logAudit({
    actor_user_id: c.userId,
    action: "coaching_note_deleted",
    resource_type: "coaching_note",
    resource_id: id,
  });
  revalidatePath("/app/coaching");
  return { ok: true };
}

// ── Nudges ──────────────────────────────────────────────────────────────────────

export async function sendNudge(input: unknown): Promise<CoachingResult> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Your session has expired." };
  if (!isCoachRole(c.role)) {
    return { ok: false, error: "You can't send nudges." };
  }
  const parsed = nudgeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Pick a reason for the nudge." };
  }
  if (!(await sameCompany(c, parsed.data.agentUserId))) {
    return { ok: false, error: "That agent isn't on your team." };
  }

  const service = createServiceClient();

  // Resolve the company that owns the DM thread (the agent's company; for a
  // super_admin coach with no company of their own, use the agent's).
  let companyId = c.companyId;
  if (!companyId) {
    const { data: agent } = await service
      .from("users")
      .select("company_id")
      .eq("id", parsed.data.agentUserId)
      .single();
    companyId = agent?.company_id ?? null;
  }
  if (!companyId) return { ok: false, error: "No company context." };

  // Decision 9: the nudge is now a real chat message in the coach↔agent DM.
  const custom = parsed.data.customMessage?.trim();
  const body = custom
    ? `👋 ${NUDGE_REASON_TEXT[parsed.data.reason] ?? "Checking in."}\n\n${custom}`
    : `👋 ${NUDGE_REASON_TEXT[parsed.data.reason] ?? "Checking in."}`;
  const sent = await sendNudgeMessage(service, {
    companyId,
    fromUserId: c.userId,
    toUserId: parsed.data.agentUserId,
    contextType: "coaching_nudge",
    contextPayload: {
      reason: parsed.data.reason,
      custom_message: custom ?? "",
    },
    body,
  });

  await notify([
    {
      userId: parsed.data.agentUserId,
      actorId: c.userId,
      kind: "coaching_nudge",
      payload: {
        reason: parsed.data.reason,
        custom_message: custom ?? "",
        ...(sent
          ? { thread_id: sent.threadId, message_id: sent.messageId }
          : {}),
      },
    },
    // Also surface it as a chat-message notification (spec: both fire).
    ...(sent
      ? [
          {
            userId: parsed.data.agentUserId,
            actorId: c.userId,
            kind: "message_received" as const,
            payload: {
              thread_id: sent.threadId,
              message_id: sent.messageId,
              sender_id: c.userId,
            },
          },
        ]
      : []),
  ]);
  await logAudit({
    actor_user_id: c.userId,
    action: "coaching_nudge_sent",
    resource_type: "user",
    resource_id: parsed.data.agentUserId,
    metadata: { reason: parsed.data.reason },
  });
  revalidatePath("/app/coaching");
  revalidatePath("/app/messages");
  return { ok: true };
}

// ── Goals ───────────────────────────────────────────────────────────────────────

export async function upsertGoal(input: unknown): Promise<CoachingResult> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Your session has expired." };
  const parsed = goalUpsertSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Please fix the form.",
    };
  }
  const g = parsed.data;

  // Agents may only edit their own goals; coaches may edit anyone's (and
  // team-wide goals). Verify same-company for any agent-scoped goal.
  const isOwn = g.userId === c.userId;
  if (!isOwn && !isCoachRole(c.role)) {
    return { ok: false, error: "You can only edit your own goals." };
  }
  if (g.userId && !(await sameCompany(c, g.userId))) {
    return { ok: false, error: "That agent isn't on your team." };
  }
  if (!c.companyId && c.role !== "super_admin") {
    return { ok: false, error: "No company context." };
  }

  const service = createServiceClient();
  if (g.id) {
    const { error } = await service
      .from("goals")
      .update({
        goal_type: g.goalType,
        period: g.period,
        period_start: g.periodStart,
        target_value: g.targetValue,
        set_by_user_id: c.userId,
      })
      .eq("id", g.id);
    if (error) return { ok: false, error: "Could not update the goal." };
  } else {
    // Resolve the company for the goal: a team-wide goal uses the caller's
    // company; an agent goal uses the agent's company.
    let companyId = c.companyId;
    if (g.userId) {
      const { data } = await service
        .from("users")
        .select("company_id")
        .eq("id", g.userId)
        .single();
      companyId = data?.company_id ?? companyId;
    }
    if (!companyId) return { ok: false, error: "No company context." };
    const { error } = await service.from("goals").insert({
      company_id: companyId,
      user_id: g.userId,
      set_by_user_id: c.userId,
      goal_type: g.goalType,
      period: g.period,
      period_start: g.periodStart,
      target_value: g.targetValue,
    });
    if (error) {
      return {
        ok: false,
        error:
          "Could not save the goal — one of this type may already exist for that period.",
      };
    }
  }

  await logAudit({
    actor_user_id: c.userId,
    action: "goal_set",
    resource_type: "goal",
    resource_id: g.id ?? null,
    metadata: { goal_type: g.goalType, user_id: g.userId },
  });
  revalidatePath("/app/coaching");
  return { ok: true };
}

export async function deleteGoal(id: string): Promise<CoachingResult> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Your session has expired." };
  const service = createServiceClient();
  const { data: goal } = await service
    .from("goals")
    .select("id, user_id")
    .eq("id", id)
    .single();
  if (!goal) return { ok: false, error: "Goal not found." };

  const isOwn = goal.user_id === c.userId;
  if (!isOwn && !isCoachRole(c.role)) {
    return { ok: false, error: "You can only delete your own goals." };
  }
  if (goal.user_id && !(await sameCompany(c, goal.user_id))) {
    return { ok: false, error: "That goal isn't on your team." };
  }

  const { error } = await service.from("goals").delete().eq("id", id);
  if (error) return { ok: false, error: "Could not delete the goal." };

  await logAudit({
    actor_user_id: c.userId,
    action: "goal_deleted",
    resource_type: "goal",
    resource_id: id,
  });
  revalidatePath("/app/coaching");
  return { ok: true };
}
