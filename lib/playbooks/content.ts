import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database, Json } from "@/types/supabase";
import type { UserRole } from "@/lib/constants/roles";

export type PlaybookSection =
  Database["public"]["Tables"]["playbook_training_sections"]["Row"];
export type PlaybookModule =
  Database["public"]["Tables"]["playbook_training_modules"]["Row"];

export type PlaybookSectionWithCount = PlaybookSection & {
  moduleCount: number;
};

type Result<T = unknown> = ({ ok: true } & T) | { ok: false; error: string };

/** Sections for a playbook, ordered, with module counts (authoring view). */
export async function listPlaybookSections(
  playbookId: string,
): Promise<PlaybookSectionWithCount[]> {
  const service = createServiceClient();
  const { data: sections } = await service
    .from("playbook_training_sections")
    .select("*")
    .eq("playbook_id", playbookId)
    .order("position", { ascending: true });
  const rows = sections ?? [];
  if (rows.length === 0) return [];

  const { data: modules } = await service
    .from("playbook_training_modules")
    .select("id, playbook_section_id")
    .in(
      "playbook_section_id",
      rows.map((s) => s.id),
    );
  const counts = new Map<string, number>();
  for (const m of modules ?? []) {
    counts.set(
      m.playbook_section_id,
      (counts.get(m.playbook_section_id) ?? 0) + 1,
    );
  }
  return rows.map((s) => ({ ...s, moduleCount: counts.get(s.id) ?? 0 }));
}

/** Every module across a playbook's sections, ordered by (section, module). */
export async function listPlaybookModules(
  playbookId: string,
): Promise<PlaybookModule[]> {
  const service = createServiceClient();
  const { data: sections } = await service
    .from("playbook_training_sections")
    .select("id, position")
    .eq("playbook_id", playbookId)
    .order("position", { ascending: true });
  const secList = sections ?? [];
  if (secList.length === 0) return [];
  const posById = new Map(secList.map((s) => [s.id, s.position]));

  const { data: modules } = await service
    .from("playbook_training_modules")
    .select("*")
    .in(
      "playbook_section_id",
      secList.map((s) => s.id),
    )
    .order("position", { ascending: true });

  return (modules ?? []).sort((a, b) => {
    const pa = posById.get(a.playbook_section_id) ?? 0;
    const pb = posById.get(b.playbook_section_id) ?? 0;
    return pa !== pb ? pa - pb : a.position - b.position;
  });
}

// ── sections ──────────────────────────────────────────────────────────────────
export type PlaybookSectionInsert = {
  title: string;
  description?: string | null;
  visibleToRoles: UserRole[];
  estimatedMinutes: number | null;
  recommendedTimelineDays: number | null;
};

export async function createPlaybookSection(
  playbookId: string,
  input: PlaybookSectionInsert,
): Promise<Result<{ id: string }>> {
  const service = createServiceClient();
  const { data: last } = await service
    .from("playbook_training_sections")
    .select("position")
    .eq("playbook_id", playbookId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = (last?.position ?? -1) + 1;

  const { data, error } = await service
    .from("playbook_training_sections")
    .insert({
      playbook_id: playbookId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      visible_to_roles: input.visibleToRoles,
      estimated_minutes: input.estimatedMinutes,
      recommended_timeline_days: input.recommendedTimelineDays,
      position,
    })
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not create section." };
  }
  return { ok: true, id: data.id };
}

export async function updatePlaybookSection(
  sectionId: string,
  input: PlaybookSectionInsert,
): Promise<Result> {
  const service = createServiceClient();
  const { error } = await service
    .from("playbook_training_sections")
    .update({
      title: input.title.trim(),
      description: input.description?.trim() || null,
      visible_to_roles: input.visibleToRoles,
      estimated_minutes: input.estimatedMinutes,
      recommended_timeline_days: input.recommendedTimelineDays,
    })
    .eq("id", sectionId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deletePlaybookSection(
  sectionId: string,
): Promise<Result> {
  const service = createServiceClient();
  const { error } = await service
    .from("playbook_training_sections")
    .delete()
    .eq("id", sectionId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function reorderPlaybookSections(
  orderedIds: string[],
): Promise<Result> {
  const service = createServiceClient();
  const results = await Promise.all(
    orderedIds.map((id, position) =>
      service
        .from("playbook_training_sections")
        .update({ position })
        .eq("id", id),
    ),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return { ok: false, error: failed.error.message };
  return { ok: true };
}

// ── modules ─────────────────────────────────────────────────────────────────--
export type PlaybookModuleInsert = {
  title: string;
  description?: string | null;
  sectionId: string;
  estimatedMinutes: number | null;
  visibleToRoles: UserRole[];
  content: Json;
};

export async function createPlaybookModule(
  input: PlaybookModuleInsert,
): Promise<Result<{ id: string }>> {
  const service = createServiceClient();
  const { data: last } = await service
    .from("playbook_training_modules")
    .select("position")
    .eq("playbook_section_id", input.sectionId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = (last?.position ?? -1) + 1;

  const { data, error } = await service
    .from("playbook_training_modules")
    .insert({
      playbook_section_id: input.sectionId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      estimated_minutes: input.estimatedMinutes,
      visible_to_roles: input.visibleToRoles.length
        ? input.visibleToRoles
        : null,
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

export async function updatePlaybookModule(
  moduleId: string,
  input: PlaybookModuleInsert,
): Promise<Result> {
  const service = createServiceClient();
  const { data: existing } = await service
    .from("playbook_training_modules")
    .select("playbook_section_id, position")
    .eq("id", moduleId)
    .maybeSingle();

  let position = existing?.position ?? 0;
  if (existing && existing.playbook_section_id !== input.sectionId) {
    const { data: last } = await service
      .from("playbook_training_modules")
      .select("position")
      .eq("playbook_section_id", input.sectionId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    position = (last?.position ?? -1) + 1;
  }

  const { error } = await service
    .from("playbook_training_modules")
    .update({
      title: input.title.trim(),
      description: input.description?.trim() || null,
      playbook_section_id: input.sectionId,
      estimated_minutes: input.estimatedMinutes,
      visible_to_roles: input.visibleToRoles.length
        ? input.visibleToRoles
        : null,
      content: input.content,
      position,
    })
    .eq("id", moduleId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deletePlaybookModule(moduleId: string): Promise<Result> {
  const service = createServiceClient();
  const { error } = await service
    .from("playbook_training_modules")
    .delete()
    .eq("id", moduleId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function reorderPlaybookModules(
  orderedIds: string[],
): Promise<Result> {
  const service = createServiceClient();
  const results = await Promise.all(
    orderedIds.map((id, position) =>
      service
        .from("playbook_training_modules")
        .update({ position })
        .eq("id", id),
    ),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return { ok: false, error: failed.error.message };
  return { ok: true };
}
