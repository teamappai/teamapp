"use server";

import { revalidatePath } from "next/cache";
import { getSessionProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { trackEvent } from "@/lib/analytics/events";

export type TrainingActionResult = { ok: true } | { ok: false; error: string };

/**
 * Record that the learner opened a module (audit: tracks engagement). Creates a
 * progress row in `in_progress` on first view and refreshes `last_viewed_at` on
 * every subsequent view, but NEVER downgrades a `completed` module. Callers must
 * skip this in preview mode (no write — PA preview).
 */
export async function recordModuleView(
  moduleId: string,
): Promise<TrainingActionResult> {
  const session = await getSessionProfile();
  if (!session) return { ok: false, error: "Not signed in." };
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("training_progress")
    .select("id, status, started_at")
    .eq("user_id", session.user.id)
    .eq("module_id", moduleId)
    .maybeSingle();

  if (!existing) {
    const { error } = await supabase.from("training_progress").insert({
      user_id: session.user.id,
      module_id: moduleId,
      status: "in_progress",
      started_at: now,
      last_viewed_at: now,
    });
    if (error) return { ok: false, error: error.message };
  } else if (existing.status !== "completed") {
    const { error } = await supabase
      .from("training_progress")
      .update({ status: "in_progress", last_viewed_at: now })
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
  }

  trackEvent("training_module_viewed", { moduleId, userId: session.user.id });
  return { ok: true };
}

/**
 * Mark a module complete (F-067). Upserts the progress row to `completed` with
 * `completed_at = now`, preserving the original `started_at`. Skipped in preview
 * mode by the caller. Auto-advance to the next module is handled client-side.
 */
export async function markModuleComplete(
  moduleId: string,
): Promise<TrainingActionResult> {
  const session = await getSessionProfile();
  if (!session) return { ok: false, error: "Not signed in." };
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("training_progress")
    .select("id, started_at")
    .eq("user_id", session.user.id)
    .eq("module_id", moduleId)
    .maybeSingle();

  if (!existing) {
    const { error } = await supabase.from("training_progress").insert({
      user_id: session.user.id,
      module_id: moduleId,
      status: "completed",
      started_at: now,
      completed_at: now,
      last_viewed_at: now,
    });
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase
      .from("training_progress")
      .update({
        status: "completed",
        completed_at: now,
        last_viewed_at: now,
        started_at: existing.started_at ?? now,
      })
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
  }

  trackEvent("training_module_completed", {
    moduleId,
    userId: session.user.id,
  });
  revalidatePath("/app/training");
  revalidatePath(`/app/training/${moduleId}`);
  return { ok: true };
}
