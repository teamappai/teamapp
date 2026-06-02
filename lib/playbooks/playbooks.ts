import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/types/supabase";
import type { PlaybookStatus } from "@/lib/constants/playbooks";
import type { PlaybookMetadataInput } from "@/lib/validations/playbook";

export type Playbook = Database["public"]["Tables"]["playbooks"]["Row"];

/** A playbook plus its section/module counts (for list + browse cards). */
export type PlaybookWithCounts = Playbook & {
  sectionCount: number;
  moduleCount: number;
};

type Result<T = unknown> = ({ ok: true } & T) | { ok: false; error: string };

/**
 * Compute section + module counts for a set of playbooks in two queries.
 * Uses the service client because pre-install RLS hides playbook_* rows from
 * customers; callers decide what to expose (only counts/metadata reach the UI).
 */
async function countsForPlaybooks(
  service: ReturnType<typeof createServiceClient>,
  playbookIds: string[],
): Promise<Map<string, { sectionCount: number; moduleCount: number }>> {
  const counts = new Map<
    string,
    { sectionCount: number; moduleCount: number }
  >();
  for (const id of playbookIds) {
    counts.set(id, { sectionCount: 0, moduleCount: 0 });
  }
  if (playbookIds.length === 0) return counts;

  const { data: sections } = await service
    .from("playbook_training_sections")
    .select("id, playbook_id")
    .in("playbook_id", playbookIds);

  const sectionToPlaybook = new Map<string, string>();
  for (const s of sections ?? []) {
    sectionToPlaybook.set(s.id, s.playbook_id);
    const c = counts.get(s.playbook_id);
    if (c) c.sectionCount += 1;
  }

  const sectionIds = (sections ?? []).map((s) => s.id);
  if (sectionIds.length) {
    const { data: modules } = await service
      .from("playbook_training_modules")
      .select("playbook_section_id")
      .in("playbook_section_id", sectionIds);
    for (const m of modules ?? []) {
      const pid = sectionToPlaybook.get(m.playbook_section_id);
      const c = pid ? counts.get(pid) : undefined;
      if (c) c.moduleCount += 1;
    }
  }
  return counts;
}

export type AdminPlaybookFilters = {
  status?: PlaybookStatus | "all";
  category?: string | "all";
  search?: string;
};

/** All playbooks for the super_admin library list (every status). */
export async function listPlaybooksAdmin(
  filters: AdminPlaybookFilters = {},
): Promise<PlaybookWithCounts[]> {
  const service = createServiceClient();
  let query = service.from("playbooks").select("*");

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters.category && filters.category !== "all") {
    query = query.eq("category", filters.category);
  }
  if (filters.search?.trim()) {
    query = query.ilike("title", `%${filters.search.trim()}%`);
  }

  const { data } = await query.order("updated_at", { ascending: false });
  const rows = data ?? [];
  const counts = await countsForPlaybooks(
    service,
    rows.map((r) => r.id),
  );
  return rows.map((r) => ({
    ...r,
    ...(counts.get(r.id) ?? { sectionCount: 0, moduleCount: 0 }),
  }));
}

/** A single playbook by id (any status) — super_admin authoring view. */
export async function getPlaybookAdmin(id: string): Promise<Playbook | null> {
  const service = createServiceClient();
  const { data } = await service
    .from("playbooks")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data ?? null;
}

/** Distinct categories present on published playbooks (browse filter chips). */
export async function listPublishedCategories(): Promise<string[]> {
  const service = createServiceClient();
  const { data } = await service
    .from("playbooks")
    .select("category")
    .eq("status", "published");
  return [...new Set((data ?? []).map((r) => r.category))].sort((a, b) =>
    a.localeCompare(b),
  );
}

/** Published playbooks for the customer browse grid, with counts. */
export async function listPublishedPlaybooks(): Promise<PlaybookWithCounts[]> {
  const service = createServiceClient();
  const { data } = await service
    .from("playbooks")
    .select("*")
    .eq("status", "published")
    .order("install_count", { ascending: false })
    .order("title", { ascending: true });
  const rows = data ?? [];
  const counts = await countsForPlaybooks(
    service,
    rows.map((r) => r.id),
  );
  return rows.map((r) => ({
    ...r,
    ...(counts.get(r.id) ?? { sectionCount: 0, moduleCount: 0 }),
  }));
}

/** Up to 3 onboarding-recommended published playbooks, most-installed first. */
export async function listOnboardingPlaybooks(): Promise<PlaybookWithCounts[]> {
  const service = createServiceClient();
  const { data } = await service
    .from("playbooks")
    .select("*")
    .eq("status", "published")
    .eq("recommended_for_onboarding", true)
    .order("install_count", { ascending: false })
    .limit(3);
  const rows = data ?? [];
  const counts = await countsForPlaybooks(
    service,
    rows.map((r) => r.id),
  );
  return rows.map((r) => ({
    ...r,
    ...(counts.get(r.id) ?? { sectionCount: 0, moduleCount: 0 }),
  }));
}

/**
 * Customer-facing detail. Returns the published playbook plus a sanitized
 * table-of-contents (section titles + module counts + module titles) — never
 * the module content blocks (Decision Q4: metadata-only preview before
 * install). Returns null for non-published playbooks.
 */
export type PlaybookToc = {
  playbook: Playbook;
  sectionCount: number;
  moduleCount: number;
  sections: {
    id: string;
    title: string;
    moduleCount: number;
    moduleTitles: string[];
  }[];
};

export async function getPublishedPlaybookToc(
  id: string,
): Promise<PlaybookToc | null> {
  const service = createServiceClient();
  const { data: playbook } = await service
    .from("playbooks")
    .select("*")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();
  if (!playbook) return null;

  const { data: sections } = await service
    .from("playbook_training_sections")
    .select("id, title, position")
    .eq("playbook_id", id)
    .order("position", { ascending: true });

  const sectionList = sections ?? [];
  const sectionIds = sectionList.map((s) => s.id);
  const modulesBySection = new Map<string, string[]>();
  if (sectionIds.length) {
    const { data: modules } = await service
      .from("playbook_training_modules")
      .select("playbook_section_id, title, position")
      .in("playbook_section_id", sectionIds)
      .order("position", { ascending: true });
    for (const m of modules ?? []) {
      const arr = modulesBySection.get(m.playbook_section_id) ?? [];
      arr.push(m.title);
      modulesBySection.set(m.playbook_section_id, arr);
    }
  }

  let moduleCount = 0;
  const toc = sectionList.map((s) => {
    const titles = modulesBySection.get(s.id) ?? [];
    moduleCount += titles.length;
    return {
      id: s.id,
      title: s.title,
      moduleCount: titles.length,
      moduleTitles: titles,
    };
  });

  return {
    playbook,
    sectionCount: sectionList.length,
    moduleCount,
    sections: toc,
  };
}

// ── mutations (super_admin; guard with requireSuperAdmin before calling) ──────
export async function isSlugTaken(
  slug: string,
  exceptId?: string,
): Promise<boolean> {
  const service = createServiceClient();
  let q = service.from("playbooks").select("id").eq("slug", slug);
  if (exceptId) q = q.neq("id", exceptId);
  const { data } = await q.maybeSingle();
  return !!data;
}

export async function createPlaybook(
  input: PlaybookMetadataInput,
  createdByUserId: string,
): Promise<Result<{ id: string }>> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("playbooks")
    .insert({
      slug: input.slug,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      category: input.category.trim(),
      icon_name: input.iconName?.trim() || null,
      cover_gradient: input.coverGradient?.trim() || null,
      credit_text: input.creditText?.trim() || null,
      recommended_for_onboarding: input.recommendedForOnboarding,
      status: "draft",
      created_by_user_id: createdByUserId,
    })
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not create playbook." };
  }
  return { ok: true, id: data.id };
}

export async function updatePlaybookMetadata(
  id: string,
  input: PlaybookMetadataInput,
): Promise<Result> {
  const service = createServiceClient();
  const { error } = await service
    .from("playbooks")
    .update({
      slug: input.slug,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      category: input.category.trim(),
      icon_name: input.iconName?.trim() || null,
      cover_gradient: input.coverGradient?.trim() || null,
      credit_text: input.creditText?.trim() || null,
      recommended_for_onboarding: input.recommendedForOnboarding,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Move a playbook through its lifecycle (draft → published → archived,
 * reversible). Stamps published_at the first time it is published.
 */
export async function setPlaybookStatus(
  id: string,
  status: PlaybookStatus,
): Promise<Result<{ title: string }>> {
  const service = createServiceClient();
  const { data: existing } = await service
    .from("playbooks")
    .select("title, published_at")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Playbook not found." };

  const patch: Database["public"]["Tables"]["playbooks"]["Update"] = { status };
  if (status === "published" && !existing.published_at) {
    patch.published_at = new Date().toISOString();
  }

  const { error } = await service.from("playbooks").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, title: existing.title };
}
