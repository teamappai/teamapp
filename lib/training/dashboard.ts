import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/constants/roles";
import {
  fetchVisibleTraining,
  type ProgressStatus,
} from "@/lib/training/experience";

/** Roles that appear in the team-lead progress roll-up (PA-2 excludes leads). */
export const DASHBOARD_ROLES: readonly UserRole[] = [
  "agent",
  "admin_tc",
  "marketing",
] as const;

/** A module is "stalled" when in_progress and untouched for this many days. */
export const STALL_DAYS = 14;
/** Banner fires when a role+section has at least this many stalled learners. */
export const STALL_ALERT_THRESHOLD = 3;

export type ModuleMeta = { id: string; title: string };

export type UserProgress = {
  userId: string;
  fullName: string | null;
  email: string;
  /** module_id -> cell, only for the modules of the owning section. */
  cells: Record<string, { status: ProgressStatus; stalled: boolean }>;
  lastActivityAt: string | null;
};

export type SectionStats = {
  sectionId: string;
  sectionTitle: string;
  modules: ModuleMeta[];
  /** modules in section × active users in role. */
  totalAssigned: number;
  startedCount: number;
  completedCount: number;
  stalledCount: number;
  percent: number;
  users: UserProgress[];
};

export type RoleStats = {
  role: UserRole;
  userCount: number;
  startedUsers: number;
  /** Aggregate completed module-progress / total assignments across the role. */
  completedAssignments: number;
  totalAssignments: number;
  percent: number;
  stalledCount: number;
  sections: SectionStats[];
};

export type StallAlert = {
  role: UserRole;
  sectionTitle: string;
  stalledCount: number;
};

export type TrainingDashboard = {
  roles: RoleStats[];
  alerts: StallAlert[];
};

type UserRow = { id: string; full_name: string | null; email: string };
type ProgressRow = {
  user_id: string;
  module_id: string;
  status: ProgressStatus;
  last_viewed_at: string | null;
};

function isStalled(row: ProgressRow, cutoffMs: number): boolean {
  return (
    row.status === "in_progress" &&
    (row.last_viewed_at == null ||
      new Date(row.last_viewed_at).getTime() < cutoffMs)
  );
}

/**
 * Build the team-lead training progress dashboard for a company (PA-2). Computes
 * Level-1 role roll-ups, Level-2 per-section breakdowns, and the Level-3 raw
 * per-user/per-module cells, plus the stalled-learner alerts. Visibility is
 * computed per target role via {@link fetchVisibleTraining}, so the numbers
 * reflect exactly what each role can see (drafts/other-role content excluded).
 */
export async function getTrainingDashboard(
  companyId: string,
): Promise<TrainingDashboard> {
  const supabase = await createClient();
  const cutoffMs = Date.now() - STALL_DAYS * 24 * 60 * 60 * 1000;

  // Active company members, grouped by the roles we report on.
  const { data: users } = await supabase
    .from("users")
    .select("id, full_name, email, role")
    .eq("company_id", companyId)
    .eq("status", "active")
    .is("deleted_at", null)
    .in("role", DASHBOARD_ROLES as unknown as string[]);

  const usersByRole = new Map<UserRole, UserRow[]>();
  for (const r of DASHBOARD_ROLES) usersByRole.set(r, []);
  for (const u of users ?? []) {
    usersByRole.get(u.role)?.push({
      id: u.id,
      full_name: u.full_name,
      email: u.email,
    });
  }

  // Visible sections+modules per role.
  const visibleByRole = new Map<
    UserRole,
    Awaited<ReturnType<typeof fetchVisibleTraining>>
  >();
  for (const role of DASHBOARD_ROLES) {
    visibleByRole.set(
      role,
      await fetchVisibleTraining(supabase, role, companyId),
    );
  }

  // One progress query for every reported user across every visible module.
  const allUserIds = [...usersByRole.values()].flat().map((u) => u.id);
  const allModuleIds = [...visibleByRole.values()]
    .flat()
    .flatMap((g) => g.modules.map((m) => m.id));

  const progress: ProgressRow[] = [];
  if (allUserIds.length && allModuleIds.length) {
    const { data } = await supabase
      .from("training_progress")
      .select("user_id, module_id, status, last_viewed_at")
      .in("user_id", allUserIds)
      .in("module_id", allModuleIds);
    progress.push(...(data ?? []));
  }

  // user_id -> module_id -> row, and per-user latest activity.
  const byUser = new Map<string, Map<string, ProgressRow>>();
  const lastActivity = new Map<string, number>();
  for (const row of progress) {
    let inner = byUser.get(row.user_id);
    if (!inner) byUser.set(row.user_id, (inner = new Map()));
    inner.set(row.module_id, row);
    if (row.last_viewed_at) {
      const t = new Date(row.last_viewed_at).getTime();
      lastActivity.set(
        row.user_id,
        Math.max(lastActivity.get(row.user_id) ?? 0, t),
      );
    }
  }

  const alerts: StallAlert[] = [];

  const roles: RoleStats[] = DASHBOARD_ROLES.map((role) => {
    const roleUsers = usersByRole.get(role) ?? [];
    const grouped = visibleByRole.get(role) ?? [];

    let roleCompleted = 0;
    let roleTotal = 0;
    let roleStalled = 0;
    const startedUserIds = new Set<string>();

    const sections: SectionStats[] = grouped.map(({ section, modules }) => {
      const moduleMetas: ModuleMeta[] = modules.map((m) => ({
        id: m.id,
        title: m.title,
      }));
      const totalAssigned = modules.length * roleUsers.length;
      let started = 0;
      let completed = 0;
      let stalled = 0;

      const sectionUsers: UserProgress[] = roleUsers.map((u) => {
        const inner = byUser.get(u.id);
        const cells: UserProgress["cells"] = {};
        for (const m of modules) {
          const row = inner?.get(m.id);
          const status: ProgressStatus = row?.status ?? "not_started";
          const stalledCell = row ? isStalled(row, cutoffMs) : false;
          cells[m.id] = { status, stalled: stalledCell };
          if (status === "in_progress" || status === "completed") {
            started++;
            startedUserIds.add(u.id);
          }
          if (status === "completed") completed++;
          if (stalledCell) stalled++;
        }
        return {
          userId: u.id,
          fullName: u.full_name,
          email: u.email,
          cells,
          lastActivityAt: lastActivity.has(u.id)
            ? new Date(lastActivity.get(u.id)!).toISOString()
            : null,
        };
      });

      roleCompleted += completed;
      roleTotal += totalAssigned;
      roleStalled += stalled;

      if (stalled >= STALL_ALERT_THRESHOLD) {
        alerts.push({
          role,
          sectionTitle: section.title,
          stalledCount: stalled,
        });
      }

      return {
        sectionId: section.id,
        sectionTitle: section.title,
        modules: moduleMetas,
        totalAssigned,
        startedCount: started,
        completedCount: completed,
        stalledCount: stalled,
        percent:
          totalAssigned === 0
            ? 0
            : Math.round((completed / totalAssigned) * 100),
        users: sectionUsers,
      };
    });

    return {
      role,
      userCount: roleUsers.length,
      startedUsers: startedUserIds.size,
      completedAssignments: roleCompleted,
      totalAssignments: roleTotal,
      percent:
        roleTotal === 0 ? 0 : Math.round((roleCompleted / roleTotal) * 100),
      stalledCount: roleStalled,
      sections,
    };
  });

  return { roles, alerts };
}
