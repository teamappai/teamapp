import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import type { UserRole } from "@/lib/constants/roles";
import { todayIso, addDaysIso } from "@/lib/coaching/dates";
import { yearStartIso } from "@/lib/dashboards/range";
import { expectedPipelineCents } from "@/lib/dashboards/pipeline-value";

/**
 * Shared dashboard data access (Phase 13). Aggregations read through the
 * service-role client paired with an explicit company filter (the Phase 11.5
 * pattern): team_leads/admin_tc need company-wide numbers that per-user RLS
 * would otherwise narrow. Every exported helper here is company-scoped.
 */

export type DashUser = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  created_at: string;
};

export type DashDeal = {
  id: string;
  stage_id: string | null;
  representing: "buyer" | "seller" | "dual" | null;
  sales_price_cents: number | null;
  gci_cents: number | null;
  commission_pct: number | null;
  close_date: string | null;
  created_by: string | null;
  listing_agent_id: string | null;
  co_listing_agent_id: string | null;
  buyer_agent_id: string | null;
  property_address: string | null;
  created_at: string;
  updated_at: string;
  stageName: string | null;
  isTerminalWon: boolean;
  isTerminalLost: boolean;
  probabilityPct: number;
};

const DASH_DEAL_SELECT = `
  id, stage_id, representing, sales_price_cents, gci_cents, commission_pct,
  close_date, created_by, listing_agent_id, co_listing_agent_id, buyer_agent_id,
  property_address, created_at, updated_at,
  stage:deal_stages!stage_id (name, is_terminal_won, is_terminal_lost, probability_pct)
` as const;

type RawDeal = Omit<
  DashDeal,
  "stageName" | "isTerminalWon" | "isTerminalLost" | "probabilityPct"
> & {
  stage: {
    name: string;
    is_terminal_won: boolean;
    is_terminal_lost: boolean;
    probability_pct: number;
  } | null;
};

function normalizeDeal(r: RawDeal): DashDeal {
  return {
    ...r,
    stageName: r.stage?.name ?? null,
    isTerminalWon: r.stage?.is_terminal_won ?? false,
    isTerminalLost: r.stage?.is_terminal_lost ?? false,
    probabilityPct: r.stage?.probability_pct ?? 0,
  };
}

/** All non-draft, non-deleted deals for a company. */
export async function fetchCompanyDeals(
  companyId: string,
): Promise<DashDeal[]> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("deals")
    .select(DASH_DEAL_SELECT)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .eq("is_draft", false);
  if (error) {
    console.error("[dashboards] fetchCompanyDeals:", error.message);
    return [];
  }
  return ((data ?? []) as unknown as RawDeal[]).map(normalizeDeal);
}

/** Deals where a specific agent is the primary owner (single attribution). */
export function dealsForAgent(deals: DashDeal[], agentId: string): DashDeal[] {
  return deals.filter((d) => primaryAgentId(d) === agentId);
}

/** The single agent a deal is attributed to (mirrors deals.primaryAgent). */
export function primaryAgentId(d: DashDeal): string | null {
  if (d.representing === "buyer") {
    return d.buyer_agent_id ?? d.created_by ?? null;
  }
  return d.listing_agent_id ?? d.created_by ?? null;
}

/** Company members (active), service-scoped. */
export async function fetchCompanyUsers(
  companyId: string,
): Promise<DashUser[]> {
  const service = createServiceClient();
  const { data } = await service
    .from("users")
    .select("id, full_name, avatar_url, role, created_at, status")
    .eq("company_id", companyId)
    .neq("status", "archived")
    .order("full_name", { ascending: true });
  return ((data ?? []) as (DashUser & { status: string })[]).map((u) => ({
    id: u.id,
    full_name: u.full_name,
    avatar_url: u.avatar_url,
    role: u.role,
    created_at: u.created_at,
  }));
}

// ── Deal KPIs ────────────────────────────────────────────────────────────────

export type DealKpis = {
  ytdGciCents: number;
  ytdVolumeCents: number;
  pipelineValueCents: number;
  /** 12-month closed GCI (cents) by month, oldest → newest. */
  gciSparkline: number[];
  /** 12-month closed volume (cents) by month, oldest → newest. */
  volumeSparkline: number[];
  /** Same windows last year, for YoY. */
  lastYearGciCents: number;
  lastYearVolumeCents: number;
};

const inYear = (iso: string | null, year: number) =>
  !!iso && iso.slice(0, 4) === String(year);

export function computeDealKpis(deals: DashDeal[]): DealKpis {
  const thisYear = Number(todayIso().slice(0, 4));
  const lastYear = thisYear - 1;

  const closed = deals.filter((d) => d.isTerminalWon);
  const closedThisYear = closed.filter((d) => inYear(d.close_date, thisYear));
  const closedLastYear = closed.filter((d) => inYear(d.close_date, lastYear));

  const ytdGciCents = closedThisYear.reduce(
    (s, d) => s + (d.gci_cents ?? 0),
    0,
  );
  const ytdVolumeCents = closedThisYear.reduce(
    (s, d) => s + (d.sales_price_cents ?? 0),
    0,
  );

  // Pipeline = expected commission across non-terminal deals (F-027 helper).
  const pipelineValueCents = expectedPipelineCents(deals);

  // 12-month sparklines keyed by YYYY-MM, oldest → newest.
  const months: string[] = [];
  {
    const m0 = Number(todayIso().slice(5, 7));
    for (let i = 11; i >= 0; i--) {
      const dt = new Date(thisYear, m0 - 1 - i, 1);
      months.push(
        `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`,
      );
    }
  }
  const gciByMonth = new Map<string, number>();
  const volByMonth = new Map<string, number>();
  for (const d of closed) {
    if (!d.close_date) continue;
    const key = d.close_date.slice(0, 7);
    gciByMonth.set(key, (gciByMonth.get(key) ?? 0) + (d.gci_cents ?? 0));
    volByMonth.set(
      key,
      (volByMonth.get(key) ?? 0) + (d.sales_price_cents ?? 0),
    );
  }
  const gciSparkline = months.map((m) => gciByMonth.get(m) ?? 0);
  const volumeSparkline = months.map((m) => volByMonth.get(m) ?? 0);

  const lastYearGciCents = closedLastYear.reduce(
    (s, d) => s + (d.gci_cents ?? 0),
    0,
  );
  const lastYearVolumeCents = closedLastYear.reduce(
    (s, d) => s + (d.sales_price_cents ?? 0),
    0,
  );

  return {
    ytdGciCents,
    ytdVolumeCents,
    pipelineValueCents,
    gciSparkline,
    volumeSparkline,
    lastYearGciCents,
    lastYearVolumeCents,
  };
}

// ── Real-estate stage cards ──────────────────────────────────────────────────

export type StageCard = {
  key: string;
  label: string;
  tooltip: string;
  count: number;
  sumCents: number | null;
  tone: "neutral" | "info" | "success" | "danger";
};

/**
 * The six dashboard stage cards mapped to the REAL (post-0023) stage set:
 * Active, Under Contract (split by side), Closed YTD, Cancelled/Expired YTD,
 * Trash. Tooltips define each stage (F-059). Colors follow F-016/F-033 —
 * in-progress is neutral/info, only losses are danger.
 */
export function buildStageCards(deals: DashDeal[]): StageCard[] {
  const year = Number(todayIso().slice(0, 4));
  const byStage = (name: string) => deals.filter((d) => d.stageName === name);
  const sum = (rows: DashDeal[]) =>
    rows.reduce((s, d) => s + (d.sales_price_cents ?? 0), 0);

  const active = byStage("Active");
  const uc = byStage("Under Contract");
  const ucBuyer = uc.filter((d) => d.representing === "buyer");
  const ucListing = uc.filter((d) => d.representing !== "buyer");
  const closedYtd = deals.filter(
    (d) => d.isTerminalWon && inYear(d.close_date, year),
  );
  const lostYtd = deals.filter(
    (d) =>
      (d.stageName === "Cancelled" || d.stageName === "Expired") &&
      d.updated_at.slice(0, 4) === String(year),
  );
  const trash = byStage("Trash");

  return [
    {
      key: "active",
      label: "Active Listings",
      tooltip:
        "Live listings on the market that have not yet gone under contract.",
      count: active.length,
      sumCents: sum(active),
      tone: "info",
    },
    {
      key: "uc_buyer",
      label: "Under Contract — Buyer side",
      tooltip:
        "Deals representing the buyer that are in escrow / under contract.",
      count: ucBuyer.length,
      sumCents: sum(ucBuyer),
      tone: "info",
    },
    {
      key: "uc_listing",
      label: "Under Contract — Listing side",
      tooltip:
        "Deals representing the seller (or dual) that are in escrow / under contract.",
      count: ucListing.length,
      sumCents: sum(ucListing),
      tone: "info",
    },
    {
      key: "closed",
      label: "Closed YTD",
      tooltip: "Deals closed (terminal-won) with a close date this year.",
      count: closedYtd.length,
      sumCents: sum(closedYtd),
      tone: "success",
    },
    {
      key: "lost",
      label: "Cancelled / Expired YTD",
      tooltip:
        "Signed agreements terminated (Cancelled) or lapsed (Expired) this year. Don't hide losses.",
      count: lostYtd.length,
      sumCents: sum(lostYtd),
      tone: "danger",
    },
    {
      key: "trash",
      label: "Trash",
      tooltip: "Early-stage catch-all losses that never became real deals.",
      count: trash.length,
      sumCents: sum(trash),
      tone: "neutral",
    },
  ];
}

// ── Upcoming closings ────────────────────────────────────────────────────────

export type UpcomingClosing = {
  dealId: string;
  property: string;
  valueCents: number | null;
  closeDate: string;
  daysUntil: number;
  agentName: string | null;
};

export function buildUpcomingClosings(
  deals: DashDeal[],
  users: Map<string, DashUser>,
  withinDays = 30,
): UpcomingClosing[] {
  const today = todayIso();
  const limit = addDaysIso(today, withinDays);
  return deals
    .filter(
      (d) =>
        !d.isTerminalWon &&
        !d.isTerminalLost &&
        d.close_date &&
        d.close_date >= today &&
        d.close_date <= limit,
    )
    .sort((a, b) => (a.close_date! < b.close_date! ? -1 : 1))
    .map((d) => {
      const agentId = primaryAgentId(d);
      return {
        dealId: d.id,
        property: d.property_address ?? "Untitled property",
        valueCents: d.sales_price_cents,
        closeDate: d.close_date!,
        daysUntil: Math.max(
          0,
          Math.round(
            (new Date(`${d.close_date}T00:00:00`).getTime() -
              new Date(`${today}T00:00:00`).getTime()) /
              86_400_000,
          ),
        ),
        agentName: agentId ? (users.get(agentId)?.full_name ?? null) : null,
      };
    });
}

// ── Activity feed enrichment ─────────────────────────────────────────────────

export type FeedCategory = "deals" | "requests" | "activity" | "training";

export type FeedItem = {
  id: string;
  eventType: string;
  category: FeedCategory;
  actorId: string;
  actorName: string | null;
  actorAvatar: string | null;
  occurredAt: string;
  text: string;
  href: string | null;
};

type RawFeedRow = {
  event_type: string;
  event_id: string;
  actor_user_id: string;
  occurred_at: string;
  payload: Record<string, unknown>;
};

const sideWord = (rep: unknown): string =>
  rep === "buyer" ? "buyer" : rep === "dual" ? "dual" : "listing";

function categoryFor(eventType: string): FeedCategory {
  if (eventType.startsWith("deal_")) return "deals";
  if (eventType === "request_created") return "requests";
  if (eventType === "training_completed") return "training";
  return "activity";
}

/**
 * Pull the role-scoped activity feed via the SECURITY DEFINER RPC, then enrich
 * each row into a human sentence with actor identity. `viewerId` drives the
 * per-role filter inside the function (Decision 10).
 */
export async function getActivityFeed(args: {
  viewerId: string;
  users: Map<string, DashUser>;
  limit?: number;
  offset?: number;
  fmtCurrency: (cents: number) => string;
}): Promise<FeedItem[]> {
  const service = createServiceClient();
  const limit = args.limit ?? 50;
  const offset = args.offset ?? 0;
  const { data, error } = await service.rpc("activity_feed_for_user", {
    p_user_id: args.viewerId,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) {
    console.error("[dashboards] activity_feed_for_user:", error.message);
    return [];
  }

  return ((data ?? []) as RawFeedRow[]).map((row) => {
    const p = row.payload ?? {};
    const actor = args.users.get(row.actor_user_id);
    const name = actor?.full_name ?? "A teammate";
    let text = "";
    let href: string | null = null;

    switch (row.event_type) {
      case "deal_created": {
        const val = p.value_cents
          ? args.fmtCurrency(Number(p.value_cents))
          : "";
        text = `${name} submitted a ${sideWord(p.representing)}-side deal${
          val ? ` at ${val}` : ""
        }${p.property ? ` (${p.property})` : ""}`;
        href = p.deal_id ? `/app/deals/${p.deal_id}` : null;
        break;
      }
      case "deal_closed": {
        const val = p.value_cents
          ? args.fmtCurrency(Number(p.value_cents))
          : "";
        text = `${name} closed a deal${val ? ` at ${val}` : ""}${
          p.property ? ` (${p.property})` : ""
        }`;
        href = p.deal_id ? `/app/deals/${p.deal_id}` : null;
        break;
      }
      case "request_created": {
        text = `${name} created a ${p.type ?? "request"}: ${p.title ?? ""}`;
        href = p.request_id ? `/app/requests/${p.request_id}` : null;
        break;
      }
      case "training_completed": {
        text = `${name} completed “${p.module_title ?? "a module"}”`;
        href = p.module_id ? `/app/training/${p.module_id}` : "/app/training";
        break;
      }
      case "activity_logged": {
        const n = Number(p.total_activities ?? 0);
        text = `${name} logged ${n} ${n === 1 ? "activity" : "activities"}`;
        href = `/app/users/${row.actor_user_id}?tab=activity`;
        break;
      }
      default:
        text = `${name} did something`;
    }

    return {
      id: `${row.event_type}:${row.event_id}`,
      eventType: row.event_type,
      category: categoryFor(row.event_type),
      actorId: row.actor_user_id,
      actorName: actor?.full_name ?? null,
      actorAvatar: actor?.avatar_url ?? null,
      occurredAt: row.occurred_at,
      text,
      href,
    };
  });
}

export { todayIso, addDaysIso, yearStartIso };
