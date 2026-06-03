import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { fetchVisibleTraining } from "@/lib/training/experience";
import {
  goalWindow,
  computeGoalActual,
  goalProgressPct,
  formatGoalValue,
  goalDef,
} from "@/lib/coaching/goals";
import type { GoalProgress } from "@/lib/coaching/queries";
import {
  fetchCompanyDeals,
  dealsForAgent,
  type DashDeal,
} from "@/lib/dashboards/shared";
import { todayIso, addDaysIso } from "@/lib/coaching/dates";
import type { DashRange } from "@/lib/dashboards/range";
import type { Database } from "@/types/supabase";
import type { UserRole } from "@/lib/constants/roles";

type GoalRow = Database["public"]["Tables"]["goals"]["Row"];

const ACTIVITY_COLS =
  "id, log_date, is_off_day, door_knocks, open_houses, conversations, seller_leads_added, buyer_leads_added, pqs, buyer_consults, listing_appts, cma_deliveries, zillow_appts_set, zillow_appts_met, showings, listings_signed, buyer_agreements_signed, offers_submitted";

export type DrillUser = {
  id: string;
  fullName: string | null;
  avatarUrl: string | null;
  role: UserRole;
  email: string | null;
  companyId: string | null;
  joinedAt: string;
  lastActivity: string | null;
};

export async function getDrillUser(agentId: string): Promise<DrillUser | null> {
  const service = createServiceClient();
  const { data } = await service
    .from("users")
    .select("id, full_name, avatar_url, role, email, company_id, created_at")
    .eq("id", agentId)
    .maybeSingle();
  if (!data) return null;
  const { data: lastAct } = await service
    .from("activity_logs")
    .select("log_date")
    .eq("user_id", agentId)
    .order("log_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  return {
    id: data.id,
    fullName: data.full_name,
    avatarUrl: data.avatar_url,
    role: data.role,
    email: data.email,
    companyId: data.company_id,
    joinedAt: data.created_at,
    lastActivity: lastAct?.log_date ?? null,
  };
}

// ── Overview tab ─────────────────────────────────────────────────────────────

export type DrillOverview = {
  closedDealsYtd: number;
  gciYtdCents: number;
  volumeYtdCents: number;
  lastActivity: string | null;
  training: { completed: number; total: number; percent: number };
  /** Full GoalProgress so the Overview tab can also drive the inline editor. */
  goals: GoalProgress[];
  recentCoaching: { id: string; body: string; occurredAt: string }[];
  recentDeals: {
    id: string;
    property: string;
    stage: string;
    createdAt: string;
  }[];
  recentRequests: {
    id: string;
    title: string;
    status: string;
    createdAt: string;
  }[];
};

const inYear = (iso: string | null, year: number) =>
  !!iso && iso.slice(0, 4) === String(year);

export async function getDrillOverview(
  agent: DrillUser,
): Promise<DrillOverview> {
  const service = createServiceClient();
  const companyId = agent.companyId;
  const year = Number(todayIso().slice(0, 4));

  const [allDeals, goalsRes, activityRes, coachingRes, requestsRes, training] =
    await Promise.all([
      companyId
        ? fetchCompanyDeals(companyId)
        : Promise.resolve([] as DashDeal[]),
      service.from("goals").select("*").eq("user_id", agent.id),
      service
        .from("activity_logs")
        .select(ACTIVITY_COLS)
        .eq("user_id", agent.id),
      service
        .from("coaching_log_entries")
        .select("id, body, occurred_at")
        .eq("agent_user_id", agent.id)
        .eq("is_test", false)
        .order("occurred_at", { ascending: false })
        .limit(3),
      service
        .from("requests")
        .select("id, title, status, created_at")
        .eq("created_by", agent.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(3),
      getDrillTrainingSummary(agent),
    ]);

  const myDeals = dealsForAgent(allDeals, agent.id);
  const closed = myDeals.filter(
    (d) => d.isTerminalWon && inYear(d.close_date, year),
  );

  const activity = (activityRes.data ?? []) as never[];
  const goals = (goalsRes.data ?? []) as GoalRow[];
  const goalViews: GoalProgress[] = goals.map((g) => {
    const w = goalWindow(g.period, g.period_start);
    const actual = computeGoalActual(g.goal_type, w, {
      activity,
      deals: myDeals.map((d) => ({
        gci_cents: d.gci_cents,
        sales_price_cents: d.sales_price_cents,
        close_date: d.close_date,
        isTerminalWon: d.isTerminalWon,
      })),
    });
    const target = Number(g.target_value);
    const def = goalDef(g.goal_type);
    return {
      id: g.id,
      goalType: g.goal_type,
      label: def.label,
      period: g.period,
      periodStart: g.period_start,
      target,
      actual,
      pct: goalProgressPct(actual, target),
      format: def.format,
      targetDisplay: formatGoalValue(g.goal_type, target),
      actualDisplay: formatGoalValue(g.goal_type, actual),
      userId: g.user_id,
      setByName: null,
    };
  });

  return {
    closedDealsYtd: closed.length,
    gciYtdCents: closed.reduce((s, d) => s + (d.gci_cents ?? 0), 0),
    volumeYtdCents: closed.reduce((s, d) => s + (d.sales_price_cents ?? 0), 0),
    lastActivity: agent.lastActivity,
    training: training.summary,
    goals: goalViews,
    recentCoaching: (
      (coachingRes.data ?? []) as {
        id: string;
        body: string;
        occurred_at: string;
      }[]
    ).map((c) => ({ id: c.id, body: c.body, occurredAt: c.occurred_at })),
    recentDeals: myDeals
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(0, 3)
      .map((d) => ({
        id: d.id,
        property: d.property_address ?? "Untitled property",
        stage: d.stageName ?? "—",
        createdAt: d.created_at,
      })),
    recentRequests: (
      (requestsRes.data ?? []) as {
        id: string;
        title: string;
        status: string;
        created_at: string;
      }[]
    ).map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      createdAt: r.created_at,
    })),
  };
}

// ── Deals tab ────────────────────────────────────────────────────────────────

export type DrillDeal = {
  id: string;
  property: string;
  representing: string;
  stage: string;
  salesPriceCents: number | null;
  gciCents: number | null;
  createdAt: string;
  closeDate: string | null;
};

export async function getDrillDeals(
  agent: DrillUser,
  range: DashRange,
): Promise<DrillDeal[]> {
  if (!agent.companyId) return [];
  const deals = await fetchCompanyDeals(agent.companyId);
  return deals
    .filter((d) => d.created_by === agent.id)
    .filter(
      (d) =>
        d.created_at.slice(0, 10) >= range.from &&
        d.created_at.slice(0, 10) <= range.to,
    )
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .map((d) => ({
      id: d.id,
      property: d.property_address ?? "Untitled property",
      representing: d.representing ?? "—",
      stage: d.stageName ?? "—",
      salesPriceCents: d.sales_price_cents,
      gciCents: d.gci_cents,
      createdAt: d.created_at,
      closeDate: d.close_date,
    }));
}

// ── Activity tab ─────────────────────────────────────────────────────────────

export type DrillActivityRow = {
  id: string;
  logDate: string;
  isOffDay: boolean;
  total: number;
  metrics: Record<string, number>;
};

const METRIC_KEYS = [
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
] as const;

export async function getDrillActivity(
  agent: DrillUser,
  range: DashRange,
): Promise<{
  rows: DrillActivityRow[];
  weekly: { date: string; total: number; isOffDay: boolean }[];
}> {
  const service = createServiceClient();
  const today = todayIso();
  const { data } = await service
    .from("activity_logs")
    .select(ACTIVITY_COLS)
    .eq("user_id", agent.id)
    .gte("log_date", range.from)
    .lte("log_date", range.to)
    .order("log_date", { ascending: false });

  const raw = (data ?? []) as unknown as (Record<
    string,
    number | string | boolean
  > & {
    id: string;
    log_date: string;
    is_off_day: boolean;
  })[];

  const rows: DrillActivityRow[] = raw.map((r) => {
    const metrics: Record<string, number> = {};
    let total = 0;
    for (const k of METRIC_KEYS) {
      const v = Number(r[k]) || 0;
      metrics[k] = v;
      total += v;
    }
    return {
      id: r.id,
      logDate: r.log_date,
      isOffDay: r.is_off_day,
      total,
      metrics,
    };
  });

  const byDate = new Map(rows.map((r) => [r.logDate, r]));
  const weekly = Array.from({ length: 7 }, (_, i) => {
    const date = addDaysIso(today, -(6 - i));
    const r = byDate.get(date);
    return { date, total: r?.total ?? 0, isOffDay: r?.isOffDay ?? false };
  });

  return { rows, weekly };
}

// ── Coaching tab ─────────────────────────────────────────────────────────────

export type CoachingReply = {
  id: string;
  body: string;
  authorId: string;
  authorName: string | null;
  authorAvatar: string | null;
  createdAt: string;
};

export type DrillCoachingNote = {
  id: string;
  body: string;
  occurredAt: string;
  authorName: string | null;
  /** Replies are omitted (empty) for admin_tc viewers (Decision 3). */
  replies: CoachingReply[];
  repliesHidden: boolean;
};

export async function getDrillCoaching(
  agent: DrillUser,
  viewerRole: UserRole,
): Promise<DrillCoachingNote[]> {
  const service = createServiceClient();
  const { data: notes } = await service
    .from("coaching_log_entries")
    .select("id, body, occurred_at, coach_user_id")
    .eq("agent_user_id", agent.id)
    .eq("is_test", false)
    .order("occurred_at", { ascending: false });

  const noteRows = (notes ?? []) as {
    id: string;
    body: string;
    occurred_at: string;
    coach_user_id: string | null;
  }[];
  if (noteRows.length === 0) return [];

  // admin_tc never sees reply threads (Decision 3).
  const repliesHidden = viewerRole === "admin_tc";

  // Resolve author names + reply authors in one pass.
  const noteIds = noteRows.map((n) => n.id);
  const repliesByNote = new Map<string, CoachingReply[]>();
  if (!repliesHidden) {
    const { data: replies } = await service
      .from("coaching_log_replies")
      .select("id, coaching_log_entry_id, body, author_user_id, created_at")
      .in("coaching_log_entry_id", noteIds)
      .order("created_at", { ascending: true });
    const replyRows = (replies ?? []) as {
      id: string;
      coaching_log_entry_id: string;
      body: string;
      author_user_id: string;
      created_at: string;
    }[];
    const authorIds = new Set<string>([
      ...replyRows.map((r) => r.author_user_id),
      ...(noteRows.map((n) => n.coach_user_id).filter(Boolean) as string[]),
    ]);
    const nameMap = await resolveNames(service, [...authorIds]);
    for (const r of replyRows) {
      const list = repliesByNote.get(r.coaching_log_entry_id) ?? [];
      const author = nameMap.get(r.author_user_id);
      list.push({
        id: r.id,
        body: r.body,
        authorId: r.author_user_id,
        authorName: author?.name ?? null,
        authorAvatar: author?.avatar ?? null,
        createdAt: r.created_at,
      });
      repliesByNote.set(r.coaching_log_entry_id, list);
    }
    return noteRows.map((n) => ({
      id: n.id,
      body: n.body,
      occurredAt: n.occurred_at,
      authorName: n.coach_user_id
        ? (nameMap.get(n.coach_user_id)?.name ?? null)
        : null,
      replies: repliesByNote.get(n.id) ?? [],
      repliesHidden: false,
    }));
  }

  // admin_tc: bodies only, no replies. Still resolve note author names.
  const coachIds = noteRows
    .map((n) => n.coach_user_id)
    .filter(Boolean) as string[];
  const nameMap = await resolveNames(service, coachIds);
  return noteRows.map((n) => ({
    id: n.id,
    body: n.body,
    occurredAt: n.occurred_at,
    authorName: n.coach_user_id
      ? (nameMap.get(n.coach_user_id)?.name ?? null)
      : null,
    replies: [],
    repliesHidden: true,
  }));
}

async function resolveNames(
  service: ReturnType<typeof createServiceClient>,
  ids: string[],
): Promise<Map<string, { name: string | null; avatar: string | null }>> {
  const map = new Map<string, { name: string | null; avatar: string | null }>();
  if (ids.length === 0) return map;
  const { data } = await service
    .from("users")
    .select("id, full_name, avatar_url")
    .in("id", ids);
  for (const u of (data ?? []) as {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  }[]) {
    map.set(u.id, { name: u.full_name, avatar: u.avatar_url });
  }
  return map;
}

// ── Training tab ─────────────────────────────────────────────────────────────

export type DrillTrainingModule = {
  id: string;
  title: string;
  status: Database["public"]["Enums"]["progress_status"];
  lastViewedAt: string | null;
  estimatedMinutes: number | null;
  stalled: boolean;
};

export type DrillTrainingSection = {
  id: string;
  title: string;
  completed: number;
  total: number;
  modules: DrillTrainingModule[];
};

export type DrillTraining = {
  summary: { completed: number; total: number; percent: number };
  sections: DrillTrainingSection[];
};

export async function getDrillTrainingSummary(
  agent: DrillUser,
): Promise<DrillTraining> {
  const service = createServiceClient();
  const today = todayIso();
  const grouped = await fetchVisibleTraining(
    service,
    agent.role,
    agent.companyId,
  );
  const moduleIds = grouped.flatMap((g) => g.modules.map((m) => m.id));

  const progressMap = new Map<
    string,
    {
      status: Database["public"]["Enums"]["progress_status"];
      lastViewedAt: string | null;
    }
  >();
  if (moduleIds.length > 0) {
    const { data } = await service
      .from("training_progress")
      .select("module_id, status, last_viewed_at")
      .eq("user_id", agent.id)
      .in("module_id", moduleIds);
    for (const p of (data ?? []) as {
      module_id: string;
      status: Database["public"]["Enums"]["progress_status"];
      last_viewed_at: string | null;
    }[]) {
      progressMap.set(p.module_id, {
        status: p.status,
        lastViewedAt: p.last_viewed_at,
      });
    }
  }

  let completedTotal = 0;
  const sections: DrillTrainingSection[] = grouped.map(
    ({ section, modules }) => {
      let completed = 0;
      const mods: DrillTrainingModule[] = modules.map((m) => {
        const p = progressMap.get(m.id);
        const status = p?.status ?? "not_started";
        if (status === "completed") completed++;
        const stalled =
          status === "in_progress" &&
          (!p?.lastViewedAt ||
            p.lastViewedAt.slice(0, 10) < addDaysIso(today, -14));
        return {
          id: m.id,
          title: m.title,
          status,
          lastViewedAt: p?.lastViewedAt ?? null,
          estimatedMinutes: m.estimated_minutes,
          stalled,
        };
      });
      completedTotal += completed;
      return {
        id: section.id,
        title: section.title,
        completed,
        total: mods.length,
        modules: mods,
      };
    },
  );

  const total = moduleIds.length;
  return {
    summary: {
      completed: completedTotal,
      total,
      percent: total === 0 ? 0 : Math.round((completedTotal / total) * 100),
    },
    sections,
  };
}
