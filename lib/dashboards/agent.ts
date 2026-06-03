import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { listDealsForScope, type DealRow } from "@/lib/deals/queries";
import { getTrainingExperience } from "@/lib/training/experience";
import { getStreak } from "@/lib/coaching/streak";
import { listThreads } from "@/lib/messages/queries";
import {
  goalWindow,
  computeGoalActual,
  goalProgressPct,
  formatGoalValue,
  goalDef,
  type GoalDealRow,
} from "@/lib/coaching/goals";
import type { Database } from "@/types/supabase";
import { todayIso, addDaysIso } from "@/lib/coaching/dates";

type GoalRow = Database["public"]["Tables"]["goals"]["Row"];

const ACTIVITY_COLS =
  "log_date, is_off_day, door_knocks, open_houses, conversations, seller_leads_added, buyer_leads_added, pqs, buyer_consults, listing_appts, cma_deliveries, zillow_appts_set, zillow_appts_met, showings, listings_signed, buyer_agreements_signed, offers_submitted";

type ActivityRow = Record<string, number | string | boolean> & {
  log_date: string;
  is_off_day: boolean;
};

export type AgentPipelineBucket = {
  key: string;
  label: string;
  count: number;
  sumCents: number;
  stageFilter: string;
};

export type AgentDashboard = {
  pipeline: AgentPipelineBucket[];
  goal: {
    label: string;
    actualText: string;
    targetText: string;
    pct: number;
  } | null;
  coachingNotes: { id: string; body: string; occurredAt: string }[];
  training: {
    completed: number;
    total: number;
    percent: number;
    nextModule: { id: string; title: string } | null;
    stalled: { id: string; title: string }[];
  };
  activity: {
    streak: number;
    loggedToday: boolean;
    weekly: { date: string; total: number; isOffDay: boolean }[];
    yesterdayTotal: number;
  };
  requests: {
    createdByMeOpen: number;
    assignedToMeOpen: number;
    statusBreakdown: { status: string; count: number }[];
  };
  todaysFocus: {
    pendingRequests: number;
    upcomingClosings: {
      dealId: string;
      property: string;
      closeDate: string;
      valueCents: number | null;
    }[];
    recentDealUpdates: { dealId: string; property: string; stage: string }[];
  };
  messages: {
    id: string;
    name: string;
    preview: string | null;
    unread: number;
  }[];
};

function metricTotal(r: ActivityRow): number {
  const keys = [
    "door_knocks",
    "open_houses",
    "conversations",
    "seller_leads_added",
    "buyer_leads_added",
    "pqs",
    "buyer_consults",
    "listing_appts",
    "cma_deliveries",
    "zillow_appts_set",
    "zillow_appts_met",
    "showings",
    "listings_signed",
    "buyer_agreements_signed",
    "offers_submitted",
  ];
  return keys.reduce((s, k) => s + (Number(r[k]) || 0), 0);
}

function toGoalDeal(d: DealRow): GoalDealRow {
  return {
    gci_cents: d.gci_cents,
    sales_price_cents: d.sales_price_cents,
    close_date: d.close_date,
    isTerminalWon: d.stage?.is_terminal_won ?? false,
  };
}

export async function getAgentDashboard(args: {
  userId: string;
  companyId: string;
  role: Database["public"]["Enums"]["user_role"];
}): Promise<AgentDashboard> {
  const supabase = await createClient();
  const service = createServiceClient();
  const today = todayIso();

  const [
    deals,
    experience,
    streak,
    threads,
    activityRes,
    goalsRes,
    requestsRes,
    coachingRes,
  ] = await Promise.all([
    listDealsForScope({
      role: "agent",
      companyId: args.companyId,
      userId: args.userId,
    }),
    getTrainingExperience(args.role, args.companyId, args.userId),
    getStreak(args.userId),
    listThreads(supabase, args.userId),
    service
      .from("activity_logs")
      .select(ACTIVITY_COLS)
      .eq("user_id", args.userId)
      .gte("log_date", addDaysIso(today, -7))
      .order("log_date", { ascending: true }),
    service.from("goals").select("*").eq("user_id", args.userId),
    service
      .from("requests")
      .select("id, status, created_by, assigned_to_user_id")
      .eq("company_id", args.companyId)
      .is("deleted_at", null)
      .or(`created_by.eq.${args.userId},assigned_to_user_id.eq.${args.userId}`),
    service
      .from("coaching_log_entries")
      .select("id, body, occurred_at")
      .eq("agent_user_id", args.userId)
      .eq("is_test", false)
      .order("occurred_at", { ascending: false })
      .limit(3),
  ]);

  // Pipeline buckets (non-terminal).
  const nonTerminal = deals.filter(
    (d) => !d.stage?.is_terminal_won && !d.stage?.is_terminal_lost,
  );
  const bucket = (
    label: string,
    key: string,
    filter: (d: DealRow) => boolean,
    stageFilter: string,
  ) => {
    const rows = nonTerminal.filter(filter);
    return {
      key,
      label,
      count: rows.length,
      sumCents: rows.reduce((s, d) => s + (d.sales_price_cents ?? 0), 0),
      stageFilter,
    };
  };
  const pipeline: AgentPipelineBucket[] = [
    bucket(
      "Active Listings",
      "active",
      (d) => d.stage?.name === "Active",
      "Active",
    ),
    bucket(
      "Under Contract — Buyer",
      "uc_buyer",
      (d) => d.stage?.name === "Under Contract" && d.representing === "buyer",
      "Under Contract",
    ),
    bucket(
      "Under Contract — Listing",
      "uc_listing",
      (d) => d.stage?.name === "Under Contract" && d.representing !== "buyer",
      "Under Contract",
    ),
    bucket(
      "Submitted / Review",
      "submitted",
      (d) => d.stage?.name === "Submitted" || d.stage?.name === "Under Review",
      "Submitted",
    ),
  ];

  // Goal (active individual goal covering today).
  const goals = (goalsRes.data ?? []) as GoalRow[];
  const activeGoal = goals
    .filter((g) => {
      const w = goalWindow(g.period, g.period_start);
      return today >= w.start && today <= w.end;
    })
    .sort((a, b) => (a.period_start < b.period_start ? 1 : -1))[0];
  let goal: AgentDashboard["goal"] = null;
  if (activeGoal) {
    const w = goalWindow(activeGoal.period, activeGoal.period_start);
    const activity = (activityRes.data ?? []) as unknown as ActivityRow[];
    // Goal actual needs full-period activity, refetch the period's rows.
    const { data: periodActivity } = await service
      .from("activity_logs")
      .select(ACTIVITY_COLS)
      .eq("user_id", args.userId)
      .gte("log_date", w.start)
      .lte("log_date", w.end);
    const actual = computeGoalActual(activeGoal.goal_type, w, {
      activity: (periodActivity ?? []) as never,
      deals: deals.map(toGoalDeal),
    });
    void activity;
    goal = {
      label: goalDef(activeGoal.goal_type).label,
      actualText: formatGoalValue(activeGoal.goal_type, actual),
      targetText: formatGoalValue(
        activeGoal.goal_type,
        Number(activeGoal.target_value),
      ),
      pct: goalProgressPct(actual, Number(activeGoal.target_value)),
    };
  }

  // Training: next + stalled.
  const flatWithStatus = experience.sections.flatMap((s) => s.modules);
  const nextModule = flatWithStatus.find(
    (m) => m.progressStatus !== "completed",
  );
  const stalled = flatWithStatus
    .filter(
      (m) =>
        m.progressStatus === "in_progress" &&
        (!m.lastViewedAt ||
          m.lastViewedAt.slice(0, 10) < addDaysIso(today, -14)),
    )
    .map((m) => ({ id: m.id, title: m.title }));

  // Activity weekly + today/yesterday.
  const activityRows = (activityRes.data ?? []) as unknown as ActivityRow[];
  const byDate = new Map(activityRows.map((r) => [r.log_date, r]));
  const weekly = Array.from({ length: 7 }, (_, i) => {
    const date = addDaysIso(today, -(6 - i));
    const r = byDate.get(date);
    return {
      date,
      total: r ? metricTotal(r) : 0,
      isOffDay: r ? r.is_off_day : false,
    };
  });
  const loggedToday = byDate.has(today);
  const yRow = byDate.get(addDaysIso(today, -1));
  const yesterdayTotal = yRow ? metricTotal(yRow) : 0;

  // Requests.
  const reqs = (requestsRes.data ?? []) as {
    id: string;
    status: string;
    created_by: string | null;
    assigned_to_user_id: string | null;
  }[];
  const open = (s: string) => s !== "completed" && s !== "rejected";
  const createdOpen = reqs.filter(
    (r) => r.created_by === args.userId && open(r.status),
  );
  const assignedOpen = reqs.filter(
    (r) => r.assigned_to_user_id === args.userId && open(r.status),
  );
  const breakdownMap = new Map<string, number>();
  for (const r of createdOpen) {
    breakdownMap.set(r.status, (breakdownMap.get(r.status) ?? 0) + 1);
  }

  // Today's focus.
  const upcoming = deals
    .filter(
      (d) =>
        !d.stage?.is_terminal_won &&
        !d.stage?.is_terminal_lost &&
        d.close_date &&
        d.close_date >= today &&
        d.close_date <= addDaysIso(today, 14),
    )
    .sort((a, b) => (a.close_date! < b.close_date! ? -1 : 1))
    .map((d) => ({
      dealId: d.id,
      property: d.property_address ?? "Untitled property",
      closeDate: d.close_date!,
      valueCents: d.sales_price_cents,
    }));
  const recentDealUpdates = deals
    .filter((d) => d.updated_at.slice(0, 10) >= addDaysIso(today, -7))
    .slice(0, 4)
    .map((d) => ({
      dealId: d.id,
      property: d.property_address ?? "Untitled property",
      stage: d.stage?.name ?? "—",
    }));

  return {
    pipeline,
    goal,
    coachingNotes: (
      (coachingRes.data ?? []) as {
        id: string;
        body: string;
        occurred_at: string;
      }[]
    ).map((c) => ({ id: c.id, body: c.body, occurredAt: c.occurred_at })),
    training: {
      completed: experience.summary.completed,
      total: experience.summary.total,
      percent: experience.summary.percent,
      nextModule: nextModule
        ? { id: nextModule.id, title: nextModule.title }
        : null,
      stalled,
    },
    activity: { streak, loggedToday, weekly, yesterdayTotal },
    requests: {
      createdByMeOpen: createdOpen.length,
      assignedToMeOpen: assignedOpen.length,
      statusBreakdown: Array.from(breakdownMap.entries()).map(
        ([status, count]) => ({
          status,
          count,
        }),
      ),
    },
    todaysFocus: {
      pendingRequests: assignedOpen.filter((r) => r.status === "pending")
        .length,
      upcomingClosings: upcoming,
      recentDealUpdates,
    },
    messages: threads.slice(0, 5).map((t) => ({
      id: t.id,
      name: t.name,
      preview: t.lastMessage?.body ?? null,
      unread: t.unreadCount,
    })),
  };
}
