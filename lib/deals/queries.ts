import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { DbClient } from "@/lib/storage";
import type { UserRole } from "@/lib/constants/roles";
import type { Database } from "@/types/supabase";

/**
 * Server-side data access for Deals. Role scoping is applied here (defense in
 * depth on top of RLS): agents see only deals they're involved in ("My Deals"),
 * admin_tc/team_lead see the whole company, super_admin sees every company.
 */

export type StageRef = {
  id: string;
  name: string;
  color: string | null;
  is_terminal_won: boolean;
  is_terminal_lost: boolean;
  probability_pct: number;
};

export type AgentRef = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
} | null;

const DEAL_SELECT = `
  id, company_id, deal_type_id, stage_id, representing,
  property_address, property_city, property_state, property_zip,
  client_first_name, client_last_name, client_email, client_phone,
  sales_price_cents, gci_cents, commission_pct,
  listing_agent_id, co_listing_agent_id, buyer_agent_id,
  listing_broker, buy_side_broker,
  rpa_signed_date, inspection_contingency_days, appraisal_contingency_days,
  loan_contingency_days, close_date, public_share_link_enabled,
  created_by, created_at, updated_at,
  stage:deal_stages!stage_id (id, name, color, is_terminal_won, is_terminal_lost, probability_pct),
  deal_type:deal_types!deal_type_id (id, name),
  company:companies!company_id (id, name),
  listing_agent:users!listing_agent_id (id, full_name, avatar_url),
  co_listing_agent:users!co_listing_agent_id (id, full_name, avatar_url),
  buyer_agent:users!buyer_agent_id (id, full_name, avatar_url)
` as const;

export type DealRow = Omit<
  Database["public"]["Tables"]["deals"]["Row"],
  never
> & {
  stage: StageRef | null;
  deal_type: { id: string; name: string } | null;
  company: { id: string; name: string } | null;
  listing_agent: AgentRef;
  co_listing_agent: AgentRef;
  buyer_agent: AgentRef;
};

/** The agent shown as the deal's primary owner in lists (buyer vs listing side). */
export function primaryAgent(deal: DealRow): AgentRef {
  if (deal.representing === "buyer") {
    return deal.buyer_agent ?? deal.listing_agent ?? null;
  }
  return deal.listing_agent ?? deal.buyer_agent ?? null;
}

/**
 * Fetch the deals visible to a user, scoped by role. Excludes soft-deleted and
 * draft rows (the base table is filtered explicitly; the active_deals view also
 * encodes this).
 */
export async function listDealsForScope(args: {
  role: UserRole;
  companyId: string | null;
  userId: string;
}): Promise<DealRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("deals")
    .select(DEAL_SELECT)
    .is("deleted_at", null)
    .eq("is_draft", false)
    .order("created_at", { ascending: false });

  if (args.role !== "super_admin" && args.companyId) {
    query = query.eq("company_id", args.companyId);
  }
  // Agents see only deals they're involved in ("My Deals").
  if (args.role === "agent") {
    const me = args.userId;
    query = query.or(
      `created_by.eq.${me},listing_agent_id.eq.${me},co_listing_agent_id.eq.${me},buyer_agent_id.eq.${me}`,
    );
  }

  const { data, error } = await query;
  if (error) {
    console.error("[deals] listDealsForScope error:", error.message);
    return [];
  }
  return (data ?? []) as unknown as DealRow[];
}

/** A single deal by id (RLS-scoped), with the same embeds as the list. */
export async function getDealById(id: string): Promise<DealRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deals")
    .select(DEAL_SELECT)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) {
    console.error("[deals] getDealById error:", error.message);
    return null;
  }
  return (data as unknown as DealRow) ?? null;
}

/** All pipeline stages available to a company (global + company-specific). */
export async function listStages(
  companyId: string | null,
): Promise<StageRef[]> {
  const supabase = await createClient();
  let query = supabase
    .from("deal_stages")
    .select(
      "id, name, color, is_terminal_won, is_terminal_lost, probability_pct",
    )
    .order("position", { ascending: true });
  query = companyId
    ? query.or(`company_id.is.null,company_id.eq.${companyId}`)
    : query.is("company_id", null);
  const { data } = await query;
  return (data ?? []) as StageRef[];
}

/** Deal types available to a company (global + company-specific). */
export async function listDealTypes(
  companyId: string | null,
): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  let query = supabase
    .from("deal_types")
    .select("id, name")
    .order("position", { ascending: true });
  query = companyId
    ? query.or(`company_id.is.null,company_id.eq.${companyId}`)
    : query.is("company_id", null);
  const { data } = await query;
  return (data ?? []) as { id: string; name: string }[];
}

export type TeamUser = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
};

/** Active company members, for the agent filter and the wizard agent selects. */
export async function listCompanyUsers(
  companyId: string | null,
): Promise<TeamUser[]> {
  if (!companyId) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("users")
    .select("id, full_name, avatar_url, role")
    .eq("company_id", companyId)
    .neq("status", "archived")
    .order("full_name", { ascending: true });
  return (data ?? []) as TeamUser[];
}

// ── deal detail sub-resources ─────────────────────────────────────────────────

export type DealFile = Database["public"]["Tables"]["deal_files"]["Row"] & {
  uploader: AgentRef;
};

export async function listDealFiles(dealId: string): Promise<DealFile[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("deal_files")
    .select("*, uploader:users!uploaded_by (id, full_name, avatar_url)")
    .eq("deal_id", dealId)
    .order("uploaded_at", { ascending: false });
  return (data ?? []) as unknown as DealFile[];
}

export type DealActivity =
  Database["public"]["Tables"]["deal_activity"]["Row"] & {
    actor: AgentRef;
  };

export async function listDealActivity(
  dealId: string,
): Promise<DealActivity[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("deal_activity")
    .select("*, actor:users!user_id (id, full_name, avatar_url)")
    .eq("deal_id", dealId)
    .order("created_at", { ascending: false });
  return (data ?? []) as unknown as DealActivity[];
}

export type DealComment =
  Database["public"]["Tables"]["deal_comments"]["Row"] & {
    author: AgentRef;
  };

export async function listDealComments(dealId: string): Promise<DealComment[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("deal_comments")
    .select("*, author:users!user_id (id, full_name, avatar_url)")
    .eq("deal_id", dealId)
    .order("created_at", { ascending: true });
  return (data ?? []) as unknown as DealComment[];
}

/** Signed download URLs for a set of deal files, keyed by file id. */
export async function signDealFileUrls(
  client: DbClient,
  files: { id: string; storage_path: string }[],
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  await Promise.all(
    files.map(async (f) => {
      const { data } = await client.storage
        .from("deal-files")
        .createSignedUrl(f.storage_path, 60 * 60);
      if (data?.signedUrl) out[f.id] = data.signedUrl;
    }),
  );
  return out;
}
