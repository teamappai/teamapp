import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

export type OnboardingProgress = {
  completed: number;
  total: number;
  /** Integer percent (audit F-118), 0 when nothing is assigned. */
  percent: number;
};

/**
 * Agent onboarding progress for the sidebar widget. Single source of truth:
 * completed modules over total assigned modules, both counted from
 * `training_progress` rows (audit F-119, F-108 — never mix "sections" and
 * "modules" units). A progress row exists for every module assigned to the user.
 */
export async function getOnboardingProgress(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<OnboardingProgress> {
  const { data, error } = await supabase
    .from("training_progress")
    .select("status")
    .eq("user_id", userId);

  if (error || !data) return { completed: 0, total: 0, percent: 0 };

  const total = data.length;
  const completed = data.filter((r) => r.status === "completed").length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  return { completed, total, percent };
}
