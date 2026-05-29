import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import type { UserRole } from "@/lib/constants/roles";

export type Section = Database["public"]["Tables"]["training_sections"]["Row"];
export type PublishStatus = Database["public"]["Enums"]["publish_status"];

export type SectionRow = Section & { moduleCount: number };

/** Sections for a company (excludes globals), ordered by position, with counts. */
export async function listSections(companyId: string): Promise<SectionRow[]> {
  const supabase = await createClient();
  const { data: sections } = await supabase
    .from("training_sections")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("position", { ascending: true });

  const rows = sections ?? [];
  if (rows.length === 0) return [];

  const { data: modules } = await supabase
    .from("training_modules")
    .select("id, section_id")
    .in(
      "section_id",
      rows.map((s) => s.id),
    )
    .is("deleted_at", null);

  const counts = new Map<string, number>();
  for (const m of modules ?? []) {
    counts.set(m.section_id, (counts.get(m.section_id) ?? 0) + 1);
  }

  return rows.map((s) => ({ ...s, moduleCount: counts.get(s.id) ?? 0 }));
}

export type SectionInput = {
  title: string;
  description?: string | null;
  visibleToRoles: UserRole[];
  status: PublishStatus;
};

export async function createSection(
  companyId: string,
  createdBy: string,
  input: SectionInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  // New sections go to the end of the order.
  const { data: last } = await supabase
    .from("training_sections")
    .select("position")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = (last?.position ?? -1) + 1;

  const { data, error } = await supabase
    .from("training_sections")
    .insert({
      company_id: companyId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      visible_to_roles: input.visibleToRoles,
      status: input.status,
      position,
      created_by: createdBy,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not create section." };
  }
  return { ok: true, id: data.id };
}

export async function updateSection(
  sectionId: string,
  input: SectionInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("training_sections")
    .update({
      title: input.title.trim(),
      description: input.description?.trim() || null,
      visible_to_roles: input.visibleToRoles,
      status: input.status,
    })
    .eq("id", sectionId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Archive = set publish status to 'archived' (kept in list with an Archived chip). */
export async function setSectionStatus(
  sectionId: string,
  status: PublishStatus,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("training_sections")
    .update({ status })
    .eq("id", sectionId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Duplicate a section and all of its modules as a Draft at the end (F-048). */
export async function duplicateSection(
  sectionId: string,
  createdBy: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: src } = await supabase
    .from("training_sections")
    .select("*")
    .eq("id", sectionId)
    .maybeSingle();
  if (!src) return { ok: false, error: "Section not found." };

  const { data: last } = await supabase
    .from("training_sections")
    .select("position")
    .eq("company_id", src.company_id!)
    .is("deleted_at", null)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = (last?.position ?? -1) + 1;

  const { data: copy, error: copyErr } = await supabase
    .from("training_sections")
    .insert({
      company_id: src.company_id,
      title: `${src.title} (Copy)`,
      description: src.description,
      visible_to_roles: src.visible_to_roles,
      status: "draft",
      position,
      created_by: createdBy,
    })
    .select("id")
    .single();
  if (copyErr || !copy) {
    return { ok: false, error: copyErr?.message ?? "Could not duplicate." };
  }

  const { data: modules } = await supabase
    .from("training_modules")
    .select("*")
    .eq("section_id", sectionId)
    .is("deleted_at", null)
    .order("position", { ascending: true });

  if (modules && modules.length) {
    const { error: modErr } = await supabase.from("training_modules").insert(
      modules.map((m) => ({
        section_id: copy.id,
        title: m.title,
        description: m.description,
        content: m.content,
        position: m.position,
        estimated_minutes: m.estimated_minutes,
        recommended_timeline_days: m.recommended_timeline_days,
        status: "draft" as PublishStatus,
        visible_to_roles: m.visible_to_roles,
      })),
    );
    if (modErr) return { ok: false, error: modErr.message };
  }

  return { ok: true, id: copy.id };
}

/** Persist a new section order. `orderedIds` is the full company section list. */
export async function reorderSections(
  orderedIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const results = await Promise.all(
    orderedIds.map((id, position) =>
      supabase.from("training_sections").update({ position }).eq("id", id),
    ),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return { ok: false, error: failed.error.message };
  return { ok: true };
}
