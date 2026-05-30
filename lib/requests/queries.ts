import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { DbClient } from "@/lib/storage";
import type { UserRole } from "@/lib/constants/roles";
import type { Database } from "@/types/supabase";

/**
 * Server-side data access for Requests. Company scoping + the marketing
 * narrowing (F-133) are applied here as defense-in-depth on top of RLS:
 *   • super_admin sees every company; everyone else is scoped to their company.
 *   • marketing only sees requests assigned to them, sitting in the marketing
 *     role-queue, or whose type routes to marketing.
 */

export type UserRef = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
} | null;

export type RequestTypeRef = {
  id: string;
  name: string;
  default_assignee_role: UserRole | null;
  category: string;
} | null;

const REQUEST_SELECT = `
  id, company_id, request_type_id, title, description, status, priority,
  created_by, assigned_to_user_id, assigned_to_role, related_deal_id,
  due_date, created_at, updated_at,
  request_type:request_types!request_type_id (id, name, default_assignee_role, category),
  assignee:users!assigned_to_user_id (id, full_name, avatar_url, role),
  creator:users!created_by (id, full_name, avatar_url, role),
  related_deal:deals!related_deal_id (id, property_address),
  company:companies!company_id (id, name)
` as const;

export type RequestRow = Database["public"]["Tables"]["requests"]["Row"] & {
  request_type: RequestTypeRef;
  assignee: UserRef;
  creator: UserRef;
  related_deal: { id: string; property_address: string | null } | null;
  company: { id: string; name: string } | null;
};

/** Request types this company can pick from (global + company-specific). */
export async function listRequestTypesForCompany(
  companyId: string | null,
): Promise<RequestTypeRef[]> {
  if (!companyId) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("request_types")
    .select("id, name, default_assignee_role, category")
    .or(`company_id.is.null,company_id.eq.${companyId}`)
    .order("position", { ascending: true });
  return (data ?? []) as RequestTypeRef[];
}

/**
 * Fetch the requests visible to a user, scoped by role. Excludes soft-deleted
 * rows. Tab membership (My queue / Team queue / My requests) is computed in the
 * client table from these rows.
 */
export async function listRequestsForScope(args: {
  role: UserRole;
  companyId: string | null;
  userId: string;
}): Promise<RequestRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("requests")
    .select(REQUEST_SELECT)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (args.role !== "super_admin" && args.companyId) {
    query = query.eq("company_id", args.companyId);
  }

  // Marketing narrowing (F-133): assigned to me, in the marketing role-queue,
  // or the request type routes to marketing.
  if (args.role === "marketing") {
    const ors = [
      `assigned_to_user_id.eq.${args.userId}`,
      `assigned_to_role.eq.marketing`,
    ];
    if (args.companyId) {
      const { data: mt } = await supabase
        .from("request_types")
        .select("id")
        .or(`company_id.is.null,company_id.eq.${args.companyId}`)
        .eq("default_assignee_role", "marketing");
      const ids = (mt ?? []).map((r) => r.id);
      if (ids.length) ors.push(`request_type_id.in.(${ids.join(",")})`);
    }
    query = query.or(ors.join(","));
  }

  const { data, error } = await query;
  if (error) {
    console.error("[requests] listRequestsForScope error:", error.message);
    return [];
  }
  return (data ?? []) as unknown as RequestRow[];
}

/** A single request by id (RLS-scoped), with the same embeds as the list. */
export async function getRequestById(id: string): Promise<RequestRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("requests")
    .select(REQUEST_SELECT)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) {
    console.error("[requests] getRequestById error:", error.message);
    return null;
  }
  return (data as unknown as RequestRow) ?? null;
}

// ── detail sub-resources ──────────────────────────────────────────────────────

export type RequestComment =
  Database["public"]["Tables"]["request_comments"]["Row"] & {
    author: UserRef;
  };

export async function listRequestComments(
  requestId: string,
): Promise<RequestComment[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("request_comments")
    .select("*, author:users!user_id (id, full_name, avatar_url, role)")
    .eq("request_id", requestId)
    .order("created_at", { ascending: true });
  return (data ?? []) as unknown as RequestComment[];
}

export type RequestFile =
  Database["public"]["Tables"]["request_files"]["Row"] & {
    uploader: UserRef;
  };

export async function listRequestFiles(
  requestId: string,
): Promise<RequestFile[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("request_files")
    .select("*, uploader:users!uploaded_by (id, full_name, avatar_url, role)")
    .eq("request_id", requestId)
    .order("uploaded_at", { ascending: false });
  return (data ?? []) as unknown as RequestFile[];
}

export type RequestStatusChange =
  Database["public"]["Tables"]["request_status_changes"]["Row"] & {
    changer: UserRef;
  };

export async function listRequestStatusChanges(
  requestId: string,
): Promise<RequestStatusChange[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("request_status_changes")
    .select("*, changer:users!changed_by (id, full_name, avatar_url, role)")
    .eq("request_id", requestId)
    .order("created_at", { ascending: false });
  return (data ?? []) as unknown as RequestStatusChange[];
}

/** Signed download URLs for a set of request files, keyed by file id. */
export async function signRequestFileUrls(
  client: DbClient,
  files: { id: string; storage_path: string }[],
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  await Promise.all(
    files.map(async (f) => {
      const { data } = await client.storage
        .from("request-files")
        .createSignedUrl(f.storage_path, 60 * 60);
      if (data?.signedUrl) out[f.id] = data.signedUrl;
    }),
  );
  return out;
}
