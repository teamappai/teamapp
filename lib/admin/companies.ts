import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { getPlan } from "@/lib/billing/plans";
import type { Database } from "@/types/supabase";

type CompanyRecord = Database["public"]["Tables"]["companies"]["Row"];
type PlanId = Database["public"]["Enums"]["company_plan"];

/** Monthly recurring revenue contribution of a company's plan, in cents. */
export function companyMrrCents(plan: PlanId): number {
  // No per-company billing cycle is stored yet (Stripe wiring is Phase 12), so
  // MRR uses the plan's monthly base price. Prices come from the canonical
  // source of truth in lib/billing/plans.ts — never hardcoded here.
  return getPlan(plan).monthly_price_cents;
}

export type CompanyRow = CompanyRecord & {
  /** Non-deleted users belonging to the company. */
  seatsUsed: number;
  /** Monthly recurring revenue contribution (0 unless status = active). */
  mrrCents: number;
  /** Latest sign of life across the company's users (last_active_at). */
  lastActivityAt: string | null;
  /** Most recent deal creation timestamp (for the attention widget). */
  lastDealAt: string | null;
};

/**
 * All companies, enriched with per-company aggregates (seats used, MRR, last
 * activity, last deal). One pass over users + deals avoids an N+1 across
 * companies. Soft-deleted rows are excluded everywhere.
 */
export async function getCompanyRows(): Promise<CompanyRow[]> {
  const service = createServiceClient();

  const [companiesRes, usersRes, dealsRes] = await Promise.all([
    service
      .from("companies")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    service
      .from("users")
      .select("company_id, last_active_at")
      .is("deleted_at", null),
    service
      .from("deals")
      .select("company_id, created_at")
      .is("deleted_at", null),
  ]);

  const companies = companiesRes.data ?? [];
  const users = usersRes.data ?? [];
  const deals = dealsRes.data ?? [];

  const seatsByCompany = new Map<string, number>();
  const lastActivityByCompany = new Map<string, string>();
  for (const u of users) {
    if (!u.company_id) continue;
    seatsByCompany.set(
      u.company_id,
      (seatsByCompany.get(u.company_id) ?? 0) + 1,
    );
    if (u.last_active_at) {
      const prev = lastActivityByCompany.get(u.company_id);
      if (!prev || u.last_active_at > prev) {
        lastActivityByCompany.set(u.company_id, u.last_active_at);
      }
    }
  }

  const lastDealByCompany = new Map<string, string>();
  for (const d of deals) {
    if (!d.company_id || !d.created_at) continue;
    const prev = lastDealByCompany.get(d.company_id);
    if (!prev || d.created_at > prev) {
      lastDealByCompany.set(d.company_id, d.created_at);
    }
  }

  return companies.map((c) => ({
    ...c,
    seatsUsed: seatsByCompany.get(c.id) ?? 0,
    mrrCents: c.status === "active" ? companyMrrCents(c.plan) : 0,
    lastActivityAt: lastActivityByCompany.get(c.id) ?? null,
    lastDealAt: lastDealByCompany.get(c.id) ?? null,
  }));
}

export type CompanyUser = Database["public"]["Tables"]["users"]["Row"];

export type CompanyDeal = {
  id: string;
  property_address: string | null;
  client_first_name: string | null;
  client_last_name: string | null;
  sales_price_cents: number | null;
  gci_cents: number | null;
  stageName: string | null;
  created_at: string;
};

export type CompanyNote = {
  id: string;
  body: string;
  created_at: string;
  authorName: string | null;
};

export type CompanyFlagOverride = {
  key: string;
  description: string | null;
  enabled_globally: boolean;
};

export type CompanyDetail = {
  company: CompanyRow;
  users: CompanyUser[];
  deals: CompanyDeal[];
  /** Stage name -> count, for the Deals-tab breakdown. */
  stageBreakdown: { stage: string; count: number }[];
  notes: CompanyNote[];
  /** Feature flags whose per-company override list includes this company. */
  flagOverrides: CompanyFlagOverride[];
  /** The team_lead, treated as the company's primary contact. */
  primaryContact: CompanyUser | null;
};

/** Full drill-in dataset for a single company, or null if not found. */
export async function getCompanyDetail(
  companyId: string,
): Promise<CompanyDetail | null> {
  const service = createServiceClient();

  const rows = await getCompanyRows();
  const company = rows.find((c) => c.id === companyId);
  if (!company) return null;

  const [usersRes, dealsRes, stagesRes, notesRes, flagsRes] = await Promise.all(
    [
      service
        .from("users")
        .select("*")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true }),
      service
        .from("deals")
        .select(
          "id, property_address, client_first_name, client_last_name, sales_price_cents, gci_cents, stage_id, created_at",
        )
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      service.from("deal_stages").select("id, name"),
      service
        .from("super_admin_notes")
        .select("id, body, created_at, created_by")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      service
        .from("feature_flags")
        .select("key, description, enabled_globally, enabled_company_ids"),
    ],
  );

  const users = usersRes.data ?? [];
  const stageName = new Map(
    (stagesRes.data ?? []).map((s) => [s.id, s.name] as const),
  );

  const deals: CompanyDeal[] = (dealsRes.data ?? []).map((d) => ({
    id: d.id,
    property_address: d.property_address,
    client_first_name: d.client_first_name,
    client_last_name: d.client_last_name,
    sales_price_cents: d.sales_price_cents,
    gci_cents: d.gci_cents,
    stageName: d.stage_id ? (stageName.get(d.stage_id) ?? null) : null,
    created_at: d.created_at,
  }));

  const breakdownMap = new Map<string, number>();
  for (const d of deals) {
    const key = d.stageName ?? "Unassigned";
    breakdownMap.set(key, (breakdownMap.get(key) ?? 0) + 1);
  }
  const stageBreakdown = [...breakdownMap.entries()].map(([stage, count]) => ({
    stage,
    count,
  }));

  // Resolve note author names without a second round-trip per note.
  const authorIds = [
    ...new Set((notesRes.data ?? []).map((n) => n.created_by).filter(Boolean)),
  ] as string[];
  const authorName = new Map<string, string | null>();
  if (authorIds.length) {
    const { data: authors } = await service
      .from("users")
      .select("id, full_name")
      .in("id", authorIds);
    for (const a of authors ?? []) authorName.set(a.id, a.full_name);
  }
  const notes: CompanyNote[] = (notesRes.data ?? []).map((n) => ({
    id: n.id,
    body: n.body,
    created_at: n.created_at,
    authorName: n.created_by ? (authorName.get(n.created_by) ?? null) : null,
  }));

  const flagOverrides: CompanyFlagOverride[] = (flagsRes.data ?? [])
    .filter((f) => (f.enabled_company_ids ?? []).includes(companyId))
    .map((f) => ({
      key: f.key,
      description: f.description,
      enabled_globally: f.enabled_globally,
    }));

  const primaryContact = users.find((u) => u.role === "team_lead") ?? null;

  return {
    company,
    users,
    deals,
    stageBreakdown,
    notes,
    flagOverrides,
    primaryContact,
  };
}
