import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/supabase";
import {
  getPlan,
  annualMonthlyEquivalentCents,
  extraSeatsMonthlyCents,
  type PlanId,
} from "@/lib/billing/plans";
import type { IdentifyCompanyInput } from "@/lib/posthog/identify";

/**
 * Build the PostHog company-group shape (Phase 15, §D). The `companies` table
 * stores `plan` + `seats_total` but derives `seats_used` (count of active
 * members) and `mrr` (normalized to a MONTHLY figure from pricing) — both are
 * computed here so the group properties match the audit plan §2 exactly.
 */
export async function buildCompanyGroup(
  supabase: SupabaseClient<Database>,
  companyId: string,
): Promise<IdentifyCompanyInput | null> {
  const { data: company } = await supabase
    .from("companies")
    .select("id, name, plan, seats_total, billing_cycle, created_at")
    .eq("id", companyId)
    .single();
  if (!company) return null;

  const { count: seatsUsed } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .is("deleted_at", null);

  return {
    id: company.id,
    name: company.name,
    plan: company.plan,
    seats_used: seatsUsed ?? null,
    seats_total: company.seats_total,
    mrr: monthlyRecurringCents(
      company.plan,
      company.seats_total,
      company.billing_cycle,
    ),
    created_at: company.created_at,
  };
}

/**
 * Monthly-normalized recurring revenue in cents. Enterprise is sales-managed
 * (no self-serve price) so we report null rather than a misleading $0.
 */
function monthlyRecurringCents(
  plan: PlanId,
  seatsTotal: number,
  cycle: string | null,
): number | null {
  if (plan === "enterprise") return null;
  const p = getPlan(plan);
  const base =
    cycle === "annual"
      ? annualMonthlyEquivalentCents(p)
      : p.monthly_price_cents;
  return base + extraSeatsMonthlyCents(plan, seatsTotal);
}
