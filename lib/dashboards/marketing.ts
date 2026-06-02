import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getTrainingExperience } from "@/lib/training/experience";
import { listThreads } from "@/lib/messages/queries";
import { todayIso } from "@/lib/coaching/dates";
import type { Database } from "@/types/supabase";

type Role = Database["public"]["Enums"]["user_role"];

export type MarketingDashboard = {
  todaysFocus: {
    assigned: { id: string; title: string; priority: string }[];
    overdue: number;
    recentlyCompleted: number;
  };
  queueByType: { type: string; count: number }[];
  training: {
    completed: number;
    total: number;
    percent: number;
    nextModuleId: string | null;
  };
  messages: {
    id: string;
    name: string;
    preview: string | null;
    unread: number;
  }[];
};

/**
 * Marketing dashboard data. Marketing only ever sees marketing-typed requests
 * (request_types.default_assignee_role = 'marketing') — never deal data (F-133).
 */
export async function getMarketingDashboard(args: {
  userId: string;
  companyId: string;
  role: Role;
}): Promise<MarketingDashboard> {
  const supabase = await createClient();
  const service = createServiceClient();
  const today = todayIso();

  const [requestsRes, experience, threads] = await Promise.all([
    service
      .from("requests")
      .select(
        "id, title, status, priority, due_date, assigned_to_user_id, assigned_to_role, updated_at, request_types!inner(name, default_assignee_role)",
      )
      .eq("company_id", args.companyId)
      .is("deleted_at", null),
    getTrainingExperience(args.role, args.companyId, args.userId),
    listThreads(supabase, args.userId),
  ]);

  const requests = (requestsRes.data ?? []) as unknown as {
    id: string;
    title: string;
    status: string;
    priority: string;
    due_date: string | null;
    assigned_to_user_id: string | null;
    assigned_to_role: Role | null;
    updated_at: string;
    request_types: { name: string; default_assignee_role: Role | null };
  }[];

  // Marketing-typed only.
  const marketingReqs = requests.filter(
    (r) => r.request_types.default_assignee_role === "marketing",
  );
  const open = (s: string) => s !== "completed" && s !== "rejected";
  const mine = marketingReqs.filter(
    (r) =>
      r.assigned_to_user_id === args.userId || r.assigned_to_role === args.role,
  );

  const assigned = mine
    .filter((r) => open(r.status))
    .slice(0, 6)
    .map((r) => ({ id: r.id, title: r.title, priority: r.priority }));
  const overdue = mine.filter(
    (r) => open(r.status) && r.due_date && r.due_date < today,
  ).length;
  const recentlyCompleted = marketingReqs.filter(
    (r) => r.status === "completed",
  ).length;

  // Queue by type (marketing types only).
  const typeMap = new Map<string, number>();
  for (const r of marketingReqs.filter((r) => open(r.status))) {
    typeMap.set(
      r.request_types.name,
      (typeMap.get(r.request_types.name) ?? 0) + 1,
    );
  }
  const queueByType = Array.from(typeMap.entries()).map(([type, count]) => ({
    type,
    count,
  }));

  const nextModule = experience.sections
    .flatMap((s) => s.modules)
    .find((m) => m.progressStatus !== "completed");

  return {
    todaysFocus: { assigned, overdue, recentlyCompleted },
    queueByType,
    training: {
      completed: experience.summary.completed,
      total: experience.summary.total,
      percent: experience.summary.percent,
      nextModuleId: nextModule?.id ?? null,
    },
    messages: threads.slice(0, 5).map((t) => ({
      id: t.id,
      name: t.name,
      preview: t.lastMessage?.body ?? null,
      unread: t.unreadCount,
    })),
  };
}
