import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { UserRole } from "@/lib/constants/roles";
import { fetchVisibleTraining } from "@/lib/training/experience";

export type OnboardingProgress = {
  completed: number;
  total: number;
  /** Integer percent (audit F-118), 0 when nothing is assigned. */
  percent: number;
};

/**
 * Agent onboarding progress for the sidebar widget. Single source of truth:
 * completed MODULES over total VISIBLE modules (audit F-118, F-119, F-108 —
 * never mix "sections" and "modules" units, and never count progress rows that
 * don't correspond to a currently-visible module). `total` is the number of
 * published modules assigned to the learner's role; `completed` is how many of
 * those have a `completed` progress row.
 */
export async function getOnboardingProgress(
  supabase: SupabaseClient<Database>,
  userId: string,
  role: UserRole,
  companyId: string | null,
): Promise<OnboardingProgress> {
  const grouped = await fetchVisibleTraining(supabase, role, companyId);
  const moduleIds = grouped.flatMap((g) => g.modules.map((m) => m.id));
  const total = moduleIds.length;
  if (total === 0) return { completed: 0, total: 0, percent: 0 };

  const { data } = await supabase
    .from("training_progress")
    .select("module_id, status")
    .eq("user_id", userId)
    .eq("status", "completed")
    .in("module_id", moduleIds);

  const completed = (data ?? []).length;
  const percent = Math.round((completed / total) * 100);
  return { completed, total, percent };
}
