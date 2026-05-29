import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import type { Json } from "@/types/supabase";
import type { UserRole } from "@/lib/constants/roles";
import type { PublishStatus } from "@/lib/team/sections";

export type ModuleRecord =
  Database["public"]["Tables"]["training_modules"]["Row"];

export type ModuleRow = ModuleRecord & {
  sectionTitle: string;
  sectionPosition: number;
};

/**
 * Every module across the company's sections, ordered by (section position,
 * module position). Joined with the parent section title for the list view.
 */
export async function listModules(companyId: string): Promise<ModuleRow[]> {
  const supabase = await createClient();
  const { data: sections } = await supabase
    .from("training_sections")
    .select("id, title, position")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("position", { ascending: true });

  const secList = sections ?? [];
  if (secList.length === 0) return [];
  const secById = new Map(secList.map((s) => [s.id, s]));

  const { data: modules } = await supabase
    .from("training_modules")
    .select("*")
    .in(
      "section_id",
      secList.map((s) => s.id),
    )
    .is("deleted_at", null)
    .order("position", { ascending: true });

  const rows = (modules ?? []).map((m) => {
    const s = secById.get(m.section_id);
    return {
      ...m,
      sectionTitle: s?.title ?? "—",
      sectionPosition: s?.position ?? 0,
    };
  });

  rows.sort((a, b) =>
    a.sectionPosition !== b.sectionPosition
      ? a.sectionPosition - b.sectionPosition
      : a.position - b.position,
  );
  return rows;
}

export async function getModule(
  moduleId: string,
): Promise<ModuleRecord | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("training_modules")
    .select("*")
    .eq("id", moduleId)
    .maybeSingle();
  return data ?? null;
}

export type ModuleInput = {
  title: string;
  description?: string | null;
  sectionId: string;
  estimatedMinutes: number | null;
  recommendedTimelineDays: number | null;
  visibleToRoles: UserRole[];
  status: PublishStatus;
  content: Json;
};

export async function createModule(
  input: ModuleInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("training_modules")
    .select("position")
    .eq("section_id", input.sectionId)
    .is("deleted_at", null)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = (last?.position ?? -1) + 1;

  const { data, error } = await supabase
    .from("training_modules")
    .insert({
      section_id: input.sectionId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      estimated_minutes: input.estimatedMinutes,
      recommended_timeline_days: input.recommendedTimelineDays,
      visible_to_roles: input.visibleToRoles,
      status: input.status,
      content: input.content,
      position,
    })
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not create module." };
  }
  return { ok: true, id: data.id };
}

export async function updateModule(
  moduleId: string,
  input: ModuleInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  // Moving to a different section appends to that section's order.
  const { data: existing } = await supabase
    .from("training_modules")
    .select("section_id, position")
    .eq("id", moduleId)
    .maybeSingle();

  let position = existing?.position ?? 0;
  if (existing && existing.section_id !== input.sectionId) {
    const { data: last } = await supabase
      .from("training_modules")
      .select("position")
      .eq("section_id", input.sectionId)
      .is("deleted_at", null)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    position = (last?.position ?? -1) + 1;
  }

  const { error } = await supabase
    .from("training_modules")
    .update({
      title: input.title.trim(),
      description: input.description?.trim() || null,
      section_id: input.sectionId,
      estimated_minutes: input.estimatedMinutes,
      recommended_timeline_days: input.recommendedTimelineDays,
      visible_to_roles: input.visibleToRoles,
      status: input.status,
      content: input.content,
      position,
    })
    .eq("id", moduleId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function setModuleStatus(
  moduleId: string,
  status: PublishStatus,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("training_modules")
    .update({ status })
    .eq("id", moduleId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Move a module into a target section at a given index and renumber that
 * section (and the source section, if different). Used by cross-section DnD.
 */
export async function moveModule(
  moduleId: string,
  toSectionId: string,
  toIndex: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: moduleRow } = await supabase
    .from("training_modules")
    .select("section_id")
    .eq("id", moduleId)
    .maybeSingle();
  if (!moduleRow) return { ok: false, error: "Module not found." };

  const fromSectionId = moduleRow.section_id;

  // Pull the destination section's modules (excluding the moved one), insert.
  const { data: destModules } = await supabase
    .from("training_modules")
    .select("id")
    .eq("section_id", toSectionId)
    .is("deleted_at", null)
    .neq("id", moduleId)
    .order("position", { ascending: true });

  const destIds = (destModules ?? []).map((m) => m.id);
  const clampedIndex = Math.max(0, Math.min(toIndex, destIds.length));
  destIds.splice(clampedIndex, 0, moduleId);

  const ops: Promise<{ error: { message: string } | null }>[] = [];
  destIds.forEach((id, position) => {
    ops.push(
      (async () => {
        const { error } = await supabase
          .from("training_modules")
          .update(
            id === moduleId
              ? { section_id: toSectionId, position }
              : { position },
          )
          .eq("id", id);
        return { error };
      })(),
    );
  });

  // Renumber the source section if the module changed sections.
  if (fromSectionId !== toSectionId) {
    const { data: srcModules } = await supabase
      .from("training_modules")
      .select("id")
      .eq("section_id", fromSectionId)
      .is("deleted_at", null)
      .neq("id", moduleId)
      .order("position", { ascending: true });
    (srcModules ?? []).forEach((m, position) => {
      ops.push(
        (async () => {
          const { error } = await supabase
            .from("training_modules")
            .update({ position })
            .eq("id", m.id);
          return { error };
        })(),
      );
    });
  }

  const results = await Promise.all(ops);
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    return { ok: false, error: failed.error.message };
  }
  return { ok: true };
}

/** Reorder modules within a single section. */
export async function reorderModules(
  orderedIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const results = await Promise.all(
    orderedIds.map((id, position) =>
      supabase.from("training_modules").update({ position }).eq("id", id),
    ),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return { ok: false, error: failed.error.message };
  return { ok: true };
}
