import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/types/supabase";
import type { Json } from "@/types/supabase";

type UserRole = Database["public"]["Enums"]["user_role"];

export type AuditEntry = {
  id: string;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  payload: Json;
  ip_address: string | null;
  created_at: string;
  actor: {
    id: string | null;
    name: string | null;
    email: string | null;
    role: UserRole | null;
  };
};

export type AuditFilters = {
  /** Free-text match against actor name or email. */
  actor?: string;
  action?: string;
  resourceType?: string;
  /** ISO date (yyyy-mm-dd) inclusive lower bound. */
  from?: string;
  /** ISO date (yyyy-mm-dd) inclusive upper bound. */
  to?: string;
  limit?: number;
};

/**
 * Reverse-chronological audit log with actor resolution and optional filters.
 * Actor search resolves to matching user ids first, then filters the log.
 */
export async function listAuditLog(
  filters: AuditFilters = {},
): Promise<AuditEntry[]> {
  const service = createServiceClient();

  // Resolve an actor text search to a set of user ids up front.
  let actorIds: string[] | null = null;
  if (filters.actor?.trim()) {
    const term = `%${filters.actor.trim()}%`;
    const { data: matches } = await service
      .from("users")
      .select("id")
      .or(`email.ilike.${term},full_name.ilike.${term}`);
    actorIds = (matches ?? []).map((m) => m.id);
    if (actorIds.length === 0) return [];
  }

  let query = service
    .from("audit_log")
    .select(
      "id, action, resource_type, resource_id, payload, ip_address, created_at, actor_user_id",
    )
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? 200);

  if (filters.action) query = query.eq("action", filters.action);
  if (filters.resourceType)
    query = query.eq("resource_type", filters.resourceType);
  if (actorIds) query = query.in("actor_user_id", actorIds);
  if (filters.from)
    query = query.gte("created_at", `${filters.from}T00:00:00Z`);
  if (filters.to) query = query.lte("created_at", `${filters.to}T23:59:59Z`);

  const { data: entries } = await query;
  const rows = entries ?? [];

  const ids = [
    ...new Set(rows.map((r) => r.actor_user_id).filter(Boolean)),
  ] as string[];
  const actorById = new Map<
    string,
    { name: string | null; email: string; role: UserRole }
  >();
  if (ids.length) {
    const { data: actors } = await service
      .from("users")
      .select("id, full_name, email, role")
      .in("id", ids);
    for (const a of actors ?? [])
      actorById.set(a.id, {
        name: a.full_name,
        email: a.email,
        role: a.role,
      });
  }

  return rows.map((r) => {
    const a = r.actor_user_id ? actorById.get(r.actor_user_id) : undefined;
    return {
      id: r.id,
      action: r.action,
      resource_type: r.resource_type,
      resource_id: r.resource_id,
      payload: r.payload,
      ip_address: r.ip_address as string | null,
      created_at: r.created_at,
      actor: {
        id: r.actor_user_id,
        name: a?.name ?? null,
        email: a?.email ?? null,
        role: a?.role ?? null,
      },
    };
  });
}

/**
 * Audit entries related to a single company — either the company itself is the
 * resource, or the entry's payload references its company_id (e.g. note
 * actions). Used by the company drill-in Activity tab.
 */
export async function listCompanyActivity(
  companyId: string,
  limit = 50,
): Promise<AuditEntry[]> {
  const all = await listAuditLog({ limit: 500 });
  return all
    .filter((e) => {
      if (e.resource_id === companyId) return true;
      const payload = e.payload as Record<string, unknown> | null;
      return payload?.company_id === companyId;
    })
    .slice(0, limit);
}

/** Distinct action + resource_type values present in the log, for filter chips. */
export async function getAuditFilterOptions(): Promise<{
  actions: string[];
  resourceTypes: string[];
}> {
  const service = createServiceClient();
  const { data } = await service
    .from("audit_log")
    .select("action, resource_type")
    .order("created_at", { ascending: false })
    .limit(1000);
  const actions = new Set<string>();
  const resourceTypes = new Set<string>();
  for (const r of data ?? []) {
    if (r.action) actions.add(r.action);
    if (r.resource_type) resourceTypes.add(r.resource_type);
  }
  return {
    actions: [...actions].sort(),
    resourceTypes: [...resourceTypes].sort(),
  };
}
