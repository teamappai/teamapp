"use server";

import { revalidatePath } from "next/cache";
import { getSessionProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { captureServer } from "@/lib/posthog/server";

export type TrainingActionResult = { ok: true } | { ok: false; error: string };

/** Company-group helper: omit groups for super_admin (no company). */
function companyGroups(
  companyId: string | null,
): Record<string, string> | undefined {
  return companyId ? { company: companyId } : undefined;
}

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

  const { data: mod } = await supabase
    .from("training_modules")
    .select("section_id")
    .eq("id", moduleId)
    .maybeSingle();
  await captureServer(
    "training_module_viewed",
    {
      module_id: moduleId,
      section_id: mod?.section_id ?? null,
      role: session.profile.role,
    },
    session.user.id,
    companyGroups(session.profile.company_id),
  );
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

  // ── PostHog: training_module_completed ──────────────────────────────────────
  const startedMs = existing?.started_at
    ? Date.parse(existing.started_at)
    : null;
  const timeToComplete =
    startedMs !== null
      ? Math.max(0, Math.round((Date.parse(now) - startedMs) / 1000))
      : null;
  const { data: mod } = await supabase
    .from("training_modules")
    .select("section_id")
    .eq("id", moduleId)
    .maybeSingle();
  const sectionId = mod?.section_id ?? null;
  const groups = companyGroups(session.profile.company_id);
  await captureServer(
    "training_module_completed",
    {
      module_id: moduleId,
      section_id: sectionId,
      time_to_complete_seconds: timeToComplete,
    },
    session.user.id,
    groups,
  );

  // ── PostHog: training_section_completed ─────────────────────────────────────
  // Fires only when THIS completion finishes the section — i.e. every published
  // module in the section visible to the learner's role is now completed.
  if (sectionId) {
    const role = session.profile.role;
    const { data: sectionModules } = await supabase
      .from("training_modules")
      .select("id")
      .eq("section_id", sectionId)
      .eq("status", "published")
      .is("deleted_at", null)
      .contains("visible_to_roles", [role]);
    const moduleIds = (sectionModules ?? []).map((m) => m.id);
    if (moduleIds.length > 0) {
      const { count: completedCount } = await supabase
        .from("training_progress")
        .select("id", { count: "exact", head: true })
        .eq("user_id", session.user.id)
        .eq("status", "completed")
        .in("module_id", moduleIds);
      if ((completedCount ?? 0) >= moduleIds.length) {
        await captureServer(
          "training_section_completed",
          { section_id: sectionId, modules_count: moduleIds.length },
          session.user.id,
          groups,
        );
      }
    }
  }

  revalidatePath("/app/training");
  revalidatePath(`/app/training/${moduleId}`);
  return { ok: true };
}
