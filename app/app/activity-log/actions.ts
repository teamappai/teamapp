"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/profile";
import { canLogActivity } from "@/lib/coaching/access";
import { activityLogSchema } from "@/lib/validations/coaching";
import { zeroMetrics } from "@/lib/constants/activity-metrics";
import { getStreak } from "@/lib/coaching/streak";
import { addDaysIso, todayIso } from "@/lib/coaching/dates";
import { logAudit } from "@/lib/audit/log";
import { formatDate } from "@/lib/utils/format";

export type ActivityLogResult =
  | {
      ok: true;
      streak: number;
      todayLogged: boolean;
      message: string;
    }
  | { ok: false; error: string };

/**
 * Upsert a day's activity log (PA-5). Enforces the back-dating window
 * [today-30, today], applies off-day semantics (all metrics → 0, is_off_day
 * true), and records an audit entry when a past day is edited. Returns the
 * recomputed streak so the chip updates immediately.
 */
export async function submitActivityLog(
  input: unknown,
): Promise<ActivityLogResult> {
  const session = await getSessionProfile();
  if (!session) return { ok: false, error: "Your session has expired." };
  if (!canLogActivity(session.profile.role)) {
    return { ok: false, error: "You can't log activity." };
  }
  const companyId = session.profile.company_id;
  if (!companyId) return { ok: false, error: "No company context." };

  const parsed = activityLogSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Please fix the form.",
    };
  }
  const { logDate, isOffDay, metrics } = parsed.data;

  // Back-dating window: today back to 30 days; never the future (F-112).
  const today = todayIso();
  if (logDate > today) {
    return { ok: false, error: "You can't log a future day." };
  }
  if (logDate < addDaysIso(today, -30)) {
    return { ok: false, error: "You can only back-date up to 30 days." };
  }

  const userId = session.user.id;
  const values = isOffDay ? zeroMetrics() : metrics;

  const supabase = await createClient();
  const { error } = await supabase.from("activity_logs").upsert(
    {
      user_id: userId,
      company_id: companyId,
      log_date: logDate,
      is_off_day: isOffDay,
      // Keep the legacy "all zeros" flag aligned with off-day intent.
      marked_all_zeros: isOffDay,
      ...values,
    },
    { onConflict: "user_id,log_date" },
  );
  if (error) return { ok: false, error: "Could not save your activity." };

  // Audit back-dated edits (Phil flagged as essential).
  if (logDate !== today) {
    await logAudit({
      actor_user_id: userId,
      action: "activity_back_dated",
      resource_type: "activity_log",
      resource_id: null,
      metadata: { log_date: logDate, is_off_day: isOffDay },
    });
  }

  const streak = await getStreak(userId);
  const { count } = await supabase
    .from("activity_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("log_date", today);
  const todayLogged = (count ?? 0) > 0;

  revalidatePath("/app/activity-log");
  revalidatePath("/app/coaching");

  const message =
    logDate === today
      ? "Activity saved"
      : `Activity for ${formatDate(logDate)} saved`;
  return { ok: true, streak, todayLogged, message };
}
