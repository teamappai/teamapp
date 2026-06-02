import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/types/supabase";
import type { PlanId } from "@/lib/billing/plans";
import { installCapForPlan } from "@/lib/constants/playbooks";

export type InstallCapCheck = {
  allowed: boolean;
  current: number;
  /** Number, or -1 for unlimited (so the value stays JSON-serializable). */
  cap: number;
  planName: PlanId;
};

/** A company's current plan id (defaults to launch if somehow unset). */
export async function getCompanyPlan(companyId: string): Promise<PlanId> {
  const service = createServiceClient();
  const { data } = await service
    .from("companies")
    .select("plan")
    .eq("id", companyId)
    .maybeSingle();
  return (data?.plan as PlanId | undefined) ?? "launch";
}

/** Count a company's currently-active (not uninstalled) playbook installs. */
export async function countActiveInstalls(companyId: string): Promise<number> {
  const service = createServiceClient();
  const { count } = await service
    .from("playbook_installs")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .is("uninstalled_at", null);
  return count ?? 0;
}

/** Plan-aware concurrent install cap check (Decision 4). */
export async function checkInstallCap(
  companyId: string,
): Promise<InstallCapCheck> {
  const planName = await getCompanyPlan(companyId);
  const cap = installCapForPlan(planName);
  const current = await countActiveInstalls(companyId);
  return {
    allowed: current < cap,
    current,
    cap: cap === Infinity ? -1 : cap,
    planName,
  };
}

/** Set of playbook ids the company currently has installed. */
export async function listInstalledPlaybookIds(
  companyId: string,
): Promise<Set<string>> {
  const service = createServiceClient();
  const { data } = await service
    .from("playbook_installs")
    .select("playbook_id")
    .eq("company_id", companyId)
    .is("uninstalled_at", null);
  return new Set((data ?? []).map((r) => r.playbook_id));
}

export type InstalledPlaybook =
  Database["public"]["Tables"]["playbooks"]["Row"] & {
    installId: string;
    installedAt: string;
  };

/** Currently-installed playbooks for a company (Installed tab). */
export async function listInstalledPlaybooks(
  companyId: string,
): Promise<InstalledPlaybook[]> {
  const service = createServiceClient();
  const { data: installs } = await service
    .from("playbook_installs")
    .select("id, playbook_id, installed_at")
    .eq("company_id", companyId)
    .is("uninstalled_at", null)
    .order("installed_at", { ascending: false });
  const rows = installs ?? [];
  if (rows.length === 0) return [];

  const { data: playbooks } = await service
    .from("playbooks")
    .select("*")
    .in(
      "id",
      rows.map((r) => r.playbook_id),
    );
  const byId = new Map((playbooks ?? []).map((p) => [p.id, p]));

  return rows
    .map((r) => {
      const p = byId.get(r.playbook_id);
      if (!p) return null;
      return { ...p, installId: r.id, installedAt: r.installed_at };
    })
    .filter((x): x is InstalledPlaybook => x !== null);
}

export type PlaybookInstallRow = {
  id: string;
  companyId: string;
  companyName: string;
  plan: PlanId;
  installedAt: string;
  installedByName: string | null;
  uninstalledAt: string | null;
};

/** All installs (active + historical) for a playbook — super_admin analytics. */
export async function listInstallsForPlaybook(
  playbookId: string,
): Promise<PlaybookInstallRow[]> {
  const service = createServiceClient();
  const { data: installs } = await service
    .from("playbook_installs")
    .select(
      "id, company_id, installed_at, installed_by_user_id, uninstalled_at",
    )
    .eq("playbook_id", playbookId)
    .order("installed_at", { ascending: false });
  const rows = installs ?? [];
  if (rows.length === 0) return [];

  const companyIds = [...new Set(rows.map((r) => r.company_id))];
  const userIds = [
    ...new Set(
      rows.map((r) => r.installed_by_user_id).filter((x): x is string => !!x),
    ),
  ];

  const [{ data: companies }, { data: users }] = await Promise.all([
    service.from("companies").select("id, name, plan").in("id", companyIds),
    userIds.length
      ? service.from("users").select("id, full_name").in("id", userIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);
  const companyById = new Map((companies ?? []).map((c) => [c.id, c]));
  const userById = new Map((users ?? []).map((u) => [u.id, u.full_name]));

  return rows.map((r) => {
    const company = companyById.get(r.company_id);
    return {
      id: r.id,
      companyId: r.company_id,
      companyName: company?.name ?? "—",
      plan: (company?.plan as PlanId | undefined) ?? "launch",
      installedAt: r.installed_at,
      installedByName: r.installed_by_user_id
        ? (userById.get(r.installed_by_user_id) ?? null)
        : null,
      uninstalledAt: r.uninstalled_at,
    };
  });
}

export type InstallResult =
  | { ok: true; installId: string; sectionsCount: number; modulesCount: number }
  | { ok: false; reason: "cap"; cap: InstallCapCheck }
  | { ok: false; reason: "error"; error: string };

/**
 * Install a published playbook into a company's workspace. Enforces the plan
 * cap, then DEEP-COPIES the playbook's sections + modules into the customer's
 * training_* tables (with their company_id) so the content becomes theirs to
 * edit. Records a playbook_installs row + training_section_source links and
 * bumps the denormalized install_count.
 */
export async function installPlaybook(args: {
  playbookId: string;
  companyId: string;
  userId: string;
}): Promise<InstallResult> {
  const service = createServiceClient();

  // 1) Cap check.
  const cap = await checkInstallCap(args.companyId);
  if (!cap.allowed) return { ok: false, reason: "cap", cap };

  // 2) Playbook must exist and be published.
  const { data: playbook } = await service
    .from("playbooks")
    .select("id, status, install_count")
    .eq("id", args.playbookId)
    .maybeSingle();
  if (!playbook || playbook.status !== "published") {
    return { ok: false, reason: "error", error: "Playbook is not available." };
  }

  // Guard against a duplicate active install (also enforced by a partial
  // unique index — surface it as a friendly message rather than a 500).
  const { data: existing } = await service
    .from("playbook_installs")
    .select("id")
    .eq("playbook_id", args.playbookId)
    .eq("company_id", args.companyId)
    .is("uninstalled_at", null)
    .maybeSingle();
  if (existing) {
    return {
      ok: false,
      reason: "error",
      error: "This playbook is already installed.",
    };
  }

  // 3) Load the source content.
  const { data: sections } = await service
    .from("playbook_training_sections")
    .select("*")
    .eq("playbook_id", args.playbookId)
    .order("position", { ascending: true });
  const sectionList = sections ?? [];
  const sectionIds = sectionList.map((s) => s.id);
  const modulesBySection = new Map<
    string,
    Database["public"]["Tables"]["playbook_training_modules"]["Row"][]
  >();
  if (sectionIds.length) {
    const { data: modules } = await service
      .from("playbook_training_modules")
      .select("*")
      .in("playbook_section_id", sectionIds)
      .order("position", { ascending: true });
    for (const m of modules ?? []) {
      const arr = modulesBySection.get(m.playbook_section_id) ?? [];
      arr.push(m);
      modulesBySection.set(m.playbook_section_id, arr);
    }
  }

  // 4) Create the install record (frees us to link sources).
  const { data: install, error: installErr } = await service
    .from("playbook_installs")
    .insert({
      playbook_id: args.playbookId,
      company_id: args.companyId,
      installed_by_user_id: args.userId,
    })
    .select("id")
    .single();
  if (installErr || !install) {
    return {
      ok: false,
      reason: "error",
      error: installErr?.message ?? "Could not record install.",
    };
  }

  // New sections append after the company's existing training sections.
  const { data: lastSection } = await service
    .from("training_sections")
    .select("position")
    .eq("company_id", args.companyId)
    .is("deleted_at", null)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  let nextPosition = (lastSection?.position ?? -1) + 1;

  let modulesCount = 0;
  // 5) Deep-copy each section + its modules.
  for (const src of sectionList) {
    const { data: newSection, error: secErr } = await service
      .from("training_sections")
      .insert({
        company_id: args.companyId,
        title: src.title,
        description: src.description,
        visible_to_roles: src.visible_to_roles ?? [],
        status: "published",
        position: nextPosition,
        created_by: args.userId,
      })
      .select("id")
      .single();
    if (secErr || !newSection) {
      return {
        ok: false,
        reason: "error",
        error: secErr?.message ?? "Could not copy a section.",
      };
    }
    nextPosition += 1;

    await service.from("training_section_source").insert({
      training_section_id: newSection.id,
      playbook_install_id: install.id,
      source_playbook_section_id: src.id,
    });

    const srcModules = modulesBySection.get(src.id) ?? [];
    if (srcModules.length) {
      const { error: modErr } = await service.from("training_modules").insert(
        srcModules.map((m, i) => ({
          section_id: newSection.id,
          title: m.title,
          description: m.description,
          content: m.content,
          estimated_minutes: m.estimated_minutes,
          recommended_timeline_days: null,
          visible_to_roles: m.visible_to_roles ?? [],
          status: "published" as const,
          position: i,
        })),
      );
      if (modErr) {
        return { ok: false, reason: "error", error: modErr.message };
      }
      modulesCount += srcModules.length;
    }
  }

  // 6) Bump the denormalized install counter.
  await service
    .from("playbooks")
    .update({ install_count: (playbook.install_count ?? 0) + 1 })
    .eq("id", args.playbookId);

  return {
    ok: true,
    installId: install.id,
    sectionsCount: sectionList.length,
    modulesCount,
  };
}

/**
 * Uninstall: detach the playbook (free the cap slot) but PRESERVE the copied
 * training content (Decision 5). Decrements the install counter.
 */
export async function uninstallPlaybook(args: {
  playbookId: string;
  companyId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const service = createServiceClient();
  const { data: install } = await service
    .from("playbook_installs")
    .select("id")
    .eq("playbook_id", args.playbookId)
    .eq("company_id", args.companyId)
    .is("uninstalled_at", null)
    .maybeSingle();
  if (!install) return { ok: false, error: "Not installed." };

  const { error } = await service
    .from("playbook_installs")
    .update({ uninstalled_at: new Date().toISOString() })
    .eq("id", install.id);
  if (error) return { ok: false, error: error.message };

  const { data: playbook } = await service
    .from("playbooks")
    .select("install_count")
    .eq("id", args.playbookId)
    .maybeSingle();
  if (playbook) {
    await service
      .from("playbooks")
      .update({ install_count: Math.max(0, (playbook.install_count ?? 1) - 1) })
      .eq("id", args.playbookId);
  }
  return { ok: true };
}
