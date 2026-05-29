import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import type { UserRole } from "@/lib/constants/roles";
import { isVisibleToRole } from "@/lib/training/visibility";

type DbClient = SupabaseClient<Database>;

export type ProgressStatus = Database["public"]["Enums"]["progress_status"];
type SectionRecord = Database["public"]["Tables"]["training_sections"]["Row"];
type ModuleRecord = Database["public"]["Tables"]["training_modules"]["Row"];

export type ExperienceModule = ModuleRecord & {
  status: Database["public"]["Enums"]["publish_status"];
  progressStatus: ProgressStatus;
  lastViewedAt: string | null;
};

export type ExperienceSection = SectionRecord & {
  modules: ExperienceModule[];
  completedCount: number;
};

/** A position in the flattened, ordered list of visible modules (for nav). */
export type FlatModule = {
  id: string;
  sectionId: string;
  sectionTitle: string;
  title: string;
};

export type TrainingExperience = {
  sections: ExperienceSection[];
  /** Modules in global order (section position, then module position). */
  flat: FlatModule[];
  /** Single source of truth: completed vs total VISIBLE modules (F-118/F-119). */
  summary: { completed: number; total: number; percent: number };
};

/**
 * The ordered, role-visible published sections and their visible published
 * modules for a learner. Applies {@link isVisibleToRole} in application code on
 * top of RLS: a team_lead/super_admin's RLS bypass would otherwise surface
 * drafts and other roles' content, so we re-filter to a consistent "published
 * and assigned to my role" learner view (audit PA-1). Global sections
 * (company_id NULL) are included alongside the learner's own company.
 */
export async function fetchVisibleTraining(
  supabase: DbClient,
  role: UserRole,
  companyId: string | null,
): Promise<{ section: SectionRecord; modules: ModuleRecord[] }[]> {
  const { data: sections } = await supabase
    .from("training_sections")
    .select("*")
    .is("deleted_at", null)
    .order("position", { ascending: true });

  const visibleSections = (sections ?? []).filter(
    (s) =>
      (s.company_id === companyId || s.company_id === null) &&
      isVisibleToRole(s, role),
  );
  if (visibleSections.length === 0) return [];

  const { data: modules } = await supabase
    .from("training_modules")
    .select("*")
    .in(
      "section_id",
      visibleSections.map((s) => s.id),
    )
    .is("deleted_at", null)
    .order("position", { ascending: true });

  const bySection = new Map<string, ModuleRecord[]>();
  for (const m of modules ?? []) {
    if (!isVisibleToRole(m, role)) continue;
    const list = bySection.get(m.section_id) ?? [];
    list.push(m);
    bySection.set(m.section_id, list);
  }

  return visibleSections.map((section) => ({
    section,
    modules: bySection.get(section.id) ?? [],
  }));
}

/** Map module_id -> progress row for a single learner. */
async function progressMap(
  supabase: DbClient,
  userId: string,
  moduleIds: string[],
): Promise<
  Map<string, { status: ProgressStatus; lastViewedAt: string | null }>
> {
  const map = new Map<
    string,
    { status: ProgressStatus; lastViewedAt: string | null }
  >();
  if (moduleIds.length === 0) return map;

  const { data } = await supabase
    .from("training_progress")
    .select("module_id, status, last_viewed_at")
    .eq("user_id", userId)
    .in("module_id", moduleIds);

  for (const row of data ?? []) {
    map.set(row.module_id, {
      status: row.status,
      lastViewedAt: row.last_viewed_at,
    });
  }
  return map;
}

/**
 * Assemble the full training experience for a learner: visible sections with
 * per-module progress, a global ordered nav list, and the modules-based
 * completion summary.
 */
export async function getTrainingExperience(
  role: UserRole,
  companyId: string | null,
  userId: string,
): Promise<TrainingExperience> {
  const supabase = await createClient();
  const grouped = await fetchVisibleTraining(supabase, role, companyId);

  const allModuleIds = grouped.flatMap((g) => g.modules.map((m) => m.id));
  const progress = await progressMap(supabase, userId, allModuleIds);

  const sections: ExperienceSection[] = grouped.map(({ section, modules }) => {
    const expModules: ExperienceModule[] = modules.map((m) => {
      const p = progress.get(m.id);
      return {
        ...m,
        progressStatus: p?.status ?? "not_started",
        lastViewedAt: p?.lastViewedAt ?? null,
      };
    });
    return {
      ...section,
      modules: expModules,
      completedCount: expModules.filter((m) => m.progressStatus === "completed")
        .length,
    };
  });

  const flat: FlatModule[] = sections.flatMap((s) =>
    s.modules.map((m) => ({
      id: m.id,
      sectionId: s.id,
      sectionTitle: s.title,
      title: m.title,
    })),
  );

  const total = flat.length;
  const completed = sections.reduce((sum, s) => sum + s.completedCount, 0);
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  return { sections, flat, summary: { completed, total, percent } };
}

export type ModuleView = {
  module: ExperienceModule;
  sectionTitle: string;
  /** 1-based index in the global flat list. */
  index: number;
  total: number;
  prevId: string | null;
  nextId: string | null;
};

/**
 * Resolve a single module for the detail page along with its prev/next
 * neighbours in the global order. Returns null when the module is not visible
 * to the learner (the page renders a 403 — audit module visibility gate).
 */
export async function getModuleView(
  role: UserRole,
  companyId: string | null,
  userId: string,
  moduleId: string,
): Promise<ModuleView | null> {
  const experience = await getTrainingExperience(role, companyId, userId);
  const idx = experience.flat.findIndex((f) => f.id === moduleId);
  if (idx === -1) return null;

  const flat = experience.flat;
  const entry = flat[idx];
  const moduleEntry = experience.sections
    .flatMap((s) => s.modules)
    .find((m) => m.id === moduleId)!;

  return {
    module: moduleEntry,
    sectionTitle: entry.sectionTitle,
    index: idx + 1,
    total: flat.length,
    prevId: idx > 0 ? flat[idx - 1].id : null,
    nextId: idx < flat.length - 1 ? flat[idx + 1].id : null,
  };
}
