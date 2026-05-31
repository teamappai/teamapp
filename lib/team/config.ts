import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import type { UserRole } from "@/lib/constants/roles";

export type DealType = Database["public"]["Tables"]["deal_types"]["Row"];
export type DealStage = Database["public"]["Tables"]["deal_stages"]["Row"];
export type RequestType = Database["public"]["Tables"]["request_types"]["Row"];

type Result = { ok: true } | { ok: false; error: string };

async function nextPosition(
  table: "deal_types" | "deal_stages" | "request_types",
  companyId: string,
): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from(table)
    .select("position")
    .eq("company_id", companyId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.position ?? -1) + 1;
}

// ── deal types ────────────────────────────────────────────────────────────────
export async function listDealTypes(companyId: string): Promise<DealType[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("deal_types")
    .select("*")
    .eq("company_id", companyId)
    .order("position", { ascending: true });
  return data ?? [];
}

export async function createDealType(
  companyId: string,
  name: string,
): Promise<Result> {
  const supabase = await createClient();
  const position = await nextPosition("deal_types", companyId);
  const { error } = await supabase
    .from("deal_types")
    .insert({ company_id: companyId, name: name.trim(), position });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function updateDealType(
  id: string,
  name: string,
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("deal_types")
    .update({ name: name.trim() })
    .eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function deleteDealType(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("deal_types").delete().eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

// ── deal stages ─────────────────────────────────────────────────────────────--
export async function listDealStages(companyId: string): Promise<DealStage[]> {
  const supabase = await createClient();
  // Company-specific overrides; fall back to globals when none exist.
  const { data: own } = await supabase
    .from("deal_stages")
    .select("*")
    .eq("company_id", companyId)
    .order("position", { ascending: true });
  if (own && own.length) return own;

  const { data: globals } = await supabase
    .from("deal_stages")
    .select("*")
    .is("company_id", null)
    .order("position", { ascending: true });
  return globals ?? [];
}

export type DealStageInput = {
  name: string;
  color: string | null;
  isTerminalWon: boolean;
  isTerminalLost: boolean;
};

export async function createDealStage(
  companyId: string,
  input: DealStageInput,
): Promise<Result> {
  const supabase = await createClient();
  const position = await nextPosition("deal_stages", companyId);
  const { error } = await supabase.from("deal_stages").insert({
    company_id: companyId,
    name: input.name.trim(),
    color: input.color,
    is_terminal_won: input.isTerminalWon,
    is_terminal_lost: input.isTerminalLost,
    position,
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function updateDealStage(
  id: string,
  input: DealStageInput,
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("deal_stages")
    .update({
      name: input.name.trim(),
      color: input.color,
      is_terminal_won: input.isTerminalWon,
      is_terminal_lost: input.isTerminalLost,
    })
    .eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function deleteDealStage(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("deal_stages").delete().eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/**
 * Copy the global default stages into company-owned rows so the team can
 * customize them (rename, recolor, reorder, delete) without touching globals.
 * No-op if the company already has its own stages.
 */
export async function cloneGlobalDealStages(
  companyId: string,
): Promise<Result> {
  const supabase = await createClient();
  const { data: own } = await supabase
    .from("deal_stages")
    .select("id")
    .eq("company_id", companyId)
    .limit(1);
  if (own && own.length) return { ok: true };

  const { data: globals } = await supabase
    .from("deal_stages")
    .select("*")
    .is("company_id", null)
    .order("position", { ascending: true });

  if (!globals || globals.length === 0) return { ok: true };

  const { error } = await supabase.from("deal_stages").insert(
    globals.map((g) => ({
      company_id: companyId,
      name: g.name,
      color: g.color,
      is_terminal_won: g.is_terminal_won,
      is_terminal_lost: g.is_terminal_lost,
      position: g.position,
    })),
  );
  return error ? { ok: false, error: error.message } : { ok: true };
}

// ── request types ───────────────────────────────────────────────────────────--
export async function listRequestTypes(
  companyId: string,
): Promise<RequestType[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("request_types")
    .select("*")
    .eq("company_id", companyId)
    .order("position", { ascending: true });
  return data ?? [];
}

export type RequestCategory =
  | "agent_support"
  | "field_work"
  | "transaction_admin"
  | "other";

export type RequestTypeInput = {
  name: string;
  defaultAssigneeRole: UserRole | null;
  category: RequestCategory;
};

export async function createRequestType(
  companyId: string,
  input: RequestTypeInput,
): Promise<Result> {
  const supabase = await createClient();
  const position = await nextPosition("request_types", companyId);
  const { error } = await supabase.from("request_types").insert({
    company_id: companyId,
    name: input.name.trim(),
    default_assignee_role: input.defaultAssigneeRole,
    category: input.category,
    position,
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function updateRequestType(
  id: string,
  input: RequestTypeInput,
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("request_types")
    .update({
      name: input.name.trim(),
      default_assignee_role: input.defaultAssigneeRole,
      category: input.category,
    })
    .eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function deleteRequestType(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("request_types").delete().eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

// ── company settings ──────────────────────────────────────────────────────────
export async function getCompanySettings(
  companyId: string,
): Promise<{ leaderboardVisibleToAgents: boolean }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("companies")
    .select("leaderboard_visible_to_agents")
    .eq("id", companyId)
    .single();
  return { leaderboardVisibleToAgents: !!data?.leaderboard_visible_to_agents };
}

/** Toggle whether agents can see the full team leaderboard (Phase 10). */
export async function setLeaderboardVisible(
  companyId: string,
  enabled: boolean,
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("companies")
    .update({ leaderboard_visible_to_agents: enabled })
    .eq("id", companyId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

// ── generic reorder for any config table ──────────────────────────────────────
export async function reorderConfig(
  table: "deal_types" | "deal_stages" | "request_types",
  orderedIds: string[],
): Promise<Result> {
  const supabase = await createClient();
  const results = await Promise.all(
    orderedIds.map((id, position) =>
      supabase.from(table).update({ position }).eq("id", id),
    ),
  );
  const failed = results.find((r) => r.error);
  return failed?.error
    ? { ok: false, error: failed.error.message }
    : { ok: true };
}
