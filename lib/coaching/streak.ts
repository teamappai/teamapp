import "server-only";
import { createClient } from "@/lib/supabase/server";
import { addDaysIso, todayIso } from "@/lib/coaching/dates";

/**
 * Logging streak (PA-5 / F-116). Counts consecutive days, starting from
 * YESTERDAY and walking backwards, on which an activity_logs row exists —
 * regardless of whether that day was an off-day (off-days extend the streak by
 * design). TODAY is intentionally excluded so the chip reads "Streak: N days —
 * log today to extend it" and only ticks up once today is logged.
 *
 * A gap (a day with no row) stops the count. If yesterday has no row the streak
 * is 0 ("start a new streak today").
 */
export async function getStreak(userId: string): Promise<number> {
  const supabase = await createClient();
  // 90 days is plenty of history for a displayed streak; bound the read.
  const since = addDaysIso(todayIso(), -90);
  const { data } = await supabase
    .from("activity_logs")
    .select("log_date")
    .eq("user_id", userId)
    .gte("log_date", since)
    .order("log_date", { ascending: false });

  const logged = new Set((data ?? []).map((r) => r.log_date));

  let streak = 0;
  let cursor = addDaysIso(todayIso(), -1); // yesterday
  while (logged.has(cursor)) {
    streak += 1;
    cursor = addDaysIso(cursor, -1);
  }
  return streak;
}
