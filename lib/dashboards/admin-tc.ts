import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getTrainingExperience } from "@/lib/training/experience";
import { listThreads } from "@/lib/messages/queries";
import {
  fetchCompanyDeals,
  fetchCompanyUsers,
  buildUpcomingClosings,
  type DashUser,
} from "@/lib/dashboards/shared";
import { todayIso } from "@/lib/coaching/dates";
import type { Database } from "@/types/supabase";

type Role = Database["public"]["Enums"]["user_role"];

export type AdminTcDashboard = {
  todaysFocus: {
    overdue: { id: string; title: string; dueDate: string | null }[];
    readyForReview: number;
    highPriority: number;
  };
  queue: { status: string; count: number }[];
  recentComments: {
    requestId: string;
    requestTitle: string;
    body: string;
    createdAt: string;
    needsResponse: boolean;
  }[];
  dealsPipeline: {
    byStage: { stage: string; count: number }[];
    upcoming: {
      dealId: string;
      property: string;
      closeDate: string;
      valueCents: number | null;
    }[];
  };
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

const QUEUE_STATUSES = [
  "pending",
  "in_progress",
  "ready_for_review",
  "completed",
] as const;

export async function getAdminTcDashboard(args: {
  userId: string;
  companyId: string;
  role: Role;
}): Promise<AdminTcDashboard> {
  const supabase = await createClient();
  const service = createServiceClient();
  const today = todayIso();

  const [requestsRes, commentsRes, deals, users, experience, threads] =
    await Promise.all([
      service
        .from("requests")
        .select(
          "id, title, status, priority, due_date, assigned_to_user_id, assigned_to_role",
        )
        .eq("company_id", args.companyId)
        .is("deleted_at", null),
      service
        .from("request_comments")
        .select(
          "id, request_id, body, created_at, user_id, is_internal, requests!inner(title, company_id, created_by, assigned_to_user_id)",
        )
        .order("created_at", { ascending: false })
        .limit(40),
      fetchCompanyDeals(args.companyId),
      fetchCompanyUsers(args.companyId),
      getTrainingExperience(args.role, args.companyId, args.userId),
      listThreads(supabase, args.userId),
    ]);

  const requests = (requestsRes.data ?? []) as {
    id: string;
    title: string;
    status: string;
    priority: string;
    due_date: string | null;
    assigned_to_user_id: string | null;
    assigned_to_role: Role | null;
  }[];

  const mine = requests.filter(
    (r) =>
      r.assigned_to_user_id === args.userId || r.assigned_to_role === args.role,
  );
  const open = (s: string) => s !== "completed" && s !== "rejected";

  const overdue = mine
    .filter((r) => open(r.status) && r.due_date && r.due_date < today)
    .map((r) => ({ id: r.id, title: r.title, dueDate: r.due_date }));
  const readyForReview = mine.filter(
    (r) => r.status === "ready_for_review",
  ).length;
  const highPriority = mine.filter(
    (r) => open(r.status) && (r.priority === "urgent" || r.priority === "high"),
  ).length;

  const queue = QUEUE_STATUSES.map((status) => ({
    status,
    count: requests.filter((r) => r.status === status).length,
  }));

  // Recent comments on requests where I'm requester or assignee.
  const rawComments = (commentsRes.data ?? []) as unknown as {
    id: string;
    request_id: string;
    body: string;
    created_at: string;
    user_id: string | null;
    requests: {
      title: string;
      company_id: string;
      created_by: string | null;
      assigned_to_user_id: string | null;
    };
  }[];
  const recentComments = rawComments
    .filter(
      (c) =>
        c.requests.company_id === args.companyId &&
        (c.requests.created_by === args.userId ||
          c.requests.assigned_to_user_id === args.userId),
    )
    .slice(0, 6)
    .map((c) => ({
      requestId: c.request_id,
      requestTitle: c.requests.title,
      body: c.body,
      createdAt: c.created_at,
      needsResponse: c.user_id !== args.userId,
    }));

  // Deals pipeline (read-only operations view).
  const stageOrder = [
    "Active",
    "Under Contract",
    "Submitted",
    "Under Review",
    "Closed",
  ];
  const byStage = stageOrder
    .map((stage) => ({
      stage,
      count: deals.filter((d) => d.stageName === stage).length,
    }))
    .filter((s) => s.count > 0);
  const userMap = new Map<string, DashUser>(users.map((u) => [u.id, u]));
  const upcoming = buildUpcomingClosings(deals, userMap)
    .slice(0, 6)
    .map((u) => ({
      dealId: u.dealId,
      property: u.property,
      closeDate: u.closeDate,
      valueCents: u.valueCents,
    }));

  const nextModule = experience.sections
    .flatMap((s) => s.modules)
    .find((m) => m.progressStatus !== "completed");

  return {
    todaysFocus: { overdue, readyForReview, highPriority },
    queue,
    recentComments,
    dealsPipeline: { byStage, upcoming },
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
