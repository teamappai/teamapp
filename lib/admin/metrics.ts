import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { getCompanyRows, type CompanyRow } from "@/lib/admin/companies";

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export type AttentionReason = "past_due" | "low_seat_usage" | "no_recent_deals";

export type AttentionCompany = {
  id: string;
  name: string;
  reasons: AttentionReason[];
};

export type PlatformMetrics = {
  companies: {
    total: number;
    active: number;
    trialing: number;
    canceled: number;
  };
  mrrCents: number;
  activeUsers7d: number;
  newSignups7d: number;
  newSignups30d: number;
  attention: AttentionCompany[];
};

/** Seat-usage threshold below which a company is flagged for attention. */
const LOW_SEAT_USAGE_RATIO = 0.3;

/**
 * Platform-health KPIs and the "customers needing attention" list for the admin
 * home. MRR sums the monthly equivalents of every active company's plan (prices
 * read from lib/billing/plans.ts via getCompanyRows).
 */
export async function getPlatformMetrics(): Promise<PlatformMetrics> {
  const service = createServiceClient();
  const rows = await getCompanyRows();

  const counts = { total: rows.length, active: 0, trialing: 0, canceled: 0 };
  let mrrCents = 0;
  for (const c of rows) {
    if (c.status === "active") counts.active += 1;
    else if (c.status === "trialing") counts.trialing += 1;
    else if (c.status === "canceled") counts.canceled += 1;
    mrrCents += c.mrrCents;
  }

  const [activeUsersRes, signups7dRes, signups30dRes] = await Promise.all([
    service
      .from("users")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .gt("last_active_at", daysAgoIso(7)),
    service
      .from("users")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .gt("created_at", daysAgoIso(7)),
    service
      .from("users")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .gt("created_at", daysAgoIso(30)),
  ]);

  const thirtyDaysAgo = daysAgoIso(30);
  const attention = buildAttention(rows, thirtyDaysAgo);

  return {
    companies: counts,
    mrrCents,
    activeUsers7d: activeUsersRes.count ?? 0,
    newSignups7d: signups7dRes.count ?? 0,
    newSignups30d: signups30dRes.count ?? 0,
    attention,
  };
}

function buildAttention(
  rows: CompanyRow[],
  thirtyDaysAgo: string,
): AttentionCompany[] {
  const out: AttentionCompany[] = [];
  for (const c of rows) {
    const reasons: AttentionReason[] = [];

    if (c.status === "past_due") reasons.push("past_due");

    // Only judge seat usage / deal activity for paying-ish companies; a canceled
    // or paused account being quiet is expected, not a flag.
    if (c.status === "active" || c.status === "trialing") {
      const ratio = c.seats_total > 0 ? c.seatsUsed / c.seats_total : 0;
      if (ratio < LOW_SEAT_USAGE_RATIO) reasons.push("low_seat_usage");
      if (!c.lastDealAt || c.lastDealAt < thirtyDaysAgo) {
        reasons.push("no_recent_deals");
      }
    }

    if (reasons.length) out.push({ id: c.id, name: c.name, reasons });
  }
  return out;
}

export const ATTENTION_LABELS: Record<AttentionReason, string> = {
  past_due: "Past due",
  low_seat_usage: "Low seat usage",
  no_recent_deals: "No deals in 30d",
};
