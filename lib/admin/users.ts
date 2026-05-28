import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/types/supabase";

type UserRecord = Database["public"]["Tables"]["users"]["Row"];
type UserRole = Database["public"]["Enums"]["user_role"];

export type AdminUserRow = UserRecord & { companyName: string | null };

export type UserSearchOptions = {
  search?: string;
  role?: UserRole;
};

/** Cross-company user search for the admin Users page. */
export async function listUsers(
  opts: UserSearchOptions = {},
): Promise<AdminUserRow[]> {
  const service = createServiceClient();

  let query = service
    .from("users")
    .select("*")
    .is("deleted_at", null)
    .order("last_active_at", { ascending: false, nullsFirst: false });

  if (opts.role) query = query.eq("role", opts.role);
  if (opts.search?.trim()) {
    const term = `%${opts.search.trim()}%`;
    query = query.or(`email.ilike.${term},full_name.ilike.${term}`);
  }

  const { data: users } = await query;
  const rows = users ?? [];

  const companyIds = [
    ...new Set(rows.map((u) => u.company_id).filter(Boolean)),
  ] as string[];
  const companyName = new Map<string, string>();
  if (companyIds.length) {
    const { data: companies } = await service
      .from("companies")
      .select("id, name")
      .in("id", companyIds);
    for (const c of companies ?? []) companyName.set(c.id, c.name);
  }

  return rows.map((u) => ({
    ...u,
    companyName: u.company_id ? (companyName.get(u.company_id) ?? null) : null,
  }));
}

export type UserActivityItem = {
  kind: "deal" | "request" | "training" | "activity_log";
  label: string;
  at: string;
};

export type AdminUserDetail = {
  user: UserRecord;
  companyName: string | null;
  email: string;
  activity: UserActivityItem[];
};

/** Full detail + recent activity for a single user, or null if not found. */
export async function getUserDetail(
  userId: string,
): Promise<AdminUserDetail | null> {
  const service = createServiceClient();

  const { data: user } = await service
    .from("users")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (!user) return null;

  let companyName: string | null = null;
  if (user.company_id) {
    const { data: company } = await service
      .from("companies")
      .select("name")
      .eq("id", user.company_id)
      .maybeSingle();
    companyName = company?.name ?? null;
  }

  const [dealsRes, requestsRes, progressRes, activityRes] = await Promise.all([
    service
      .from("deals")
      .select("id, property_address, created_at")
      .eq("created_by", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(5),
    service
      .from("requests")
      .select("id, title, created_at")
      .eq("created_by", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(5),
    service
      .from("training_progress")
      .select("id, status, updated_at, module_id")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(5),
    service
      .from("activity_logs")
      .select("id, log_date, updated_at")
      .eq("user_id", userId)
      .order("log_date", { ascending: false })
      .limit(5),
  ]);

  const activity: UserActivityItem[] = [];
  for (const d of dealsRes.data ?? []) {
    activity.push({
      kind: "deal",
      label: `Created deal${d.property_address ? ` — ${d.property_address}` : ""}`,
      at: d.created_at,
    });
  }
  for (const r of requestsRes.data ?? []) {
    activity.push({
      kind: "request",
      label: `Opened request — ${r.title}`,
      at: r.created_at,
    });
  }
  for (const p of progressRes.data ?? []) {
    activity.push({
      kind: "training",
      label: `Training ${p.status.replace(/_/g, " ")}`,
      at: p.updated_at,
    });
  }
  for (const a of activityRes.data ?? []) {
    activity.push({
      kind: "activity_log",
      label: `Logged daily activity (${a.log_date})`,
      at: a.updated_at,
    });
  }

  activity.sort((x, y) => (x.at < y.at ? 1 : -1));

  return {
    user,
    companyName,
    email: user.email,
    activity: activity.slice(0, 15),
  };
}
