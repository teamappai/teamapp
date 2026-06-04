"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/profile";
import { canCreateRequests, canDeleteRequest } from "@/lib/requests/access";
import { logAudit } from "@/lib/audit/log";
import { notify } from "@/lib/notifications/notify";
import {
  createRequestSchema,
  updateRequestSchema,
  requestCommentSchema,
  requestStatusSchema,
  isSentinelTypeName,
} from "@/lib/validations/request";
import type { UserRole } from "@/lib/constants/roles";
import type { Database, Json } from "@/types/supabase";
import { captureServer } from "@/lib/posthog/server";

export type RequestActionResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;
type RequestStatus = Database["public"]["Enums"]["request_status"];

/** The minimal request shape the actions need for routing notifications. */
type RequestCore = {
  id: string;
  company_id: string;
  title: string;
  status: RequestStatus;
  created_by: string | null;
  assigned_to_user_id: string | null;
  assigned_to_role: UserRole | null;
};

async function loadRequestCore(
  supabase: SupabaseServer,
  id: string,
): Promise<RequestCore | null> {
  const { data } = await supabase
    .from("requests")
    .select(
      "id, company_id, title, status, created_by, assigned_to_user_id, assigned_to_role",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  return (data as RequestCore | null) ?? null;
}

/** Active company members holding a given role (for role-queue notifications). */
async function roleQueueUserIds(
  supabase: SupabaseServer,
  companyId: string,
  role: UserRole,
): Promise<string[]> {
  const { data } = await supabase
    .from("users")
    .select("id")
    .eq("company_id", companyId)
    .eq("role", role)
    .neq("status", "archived");
  return (data ?? []).map((u) => u.id);
}

// ── create ────────────────────────────────────────────────────────────────────
export async function createRequest(
  input: unknown,
): Promise<RequestActionResult<{ requestId: string }>> {
  const session = await getSessionProfile();
  if (!session) return { ok: false, error: "Your session has expired." };
  if (!canCreateRequests(session.profile.role)) {
    return { ok: false, error: "You can't create requests." };
  }
  const companyId = session.profile.company_id;
  if (!companyId) return { ok: false, error: "No company context." };

  const parsed = createRequestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Please fix the form.",
    };
  }
  const data = parsed.data;

  const supabase = await createClient();

  // The request type must be real (no "All Types" sentinel — F-125/F-137) and
  // belong to this company (or be a global type).
  const { data: type } = await supabase
    .from("request_types")
    .select("id, name, company_id")
    .eq("id", data.requestTypeId)
    .maybeSingle();
  if (
    !type ||
    (type.company_id !== null && type.company_id !== companyId) ||
    isSentinelTypeName(type.name)
  ) {
    return { ok: false, error: "Choose a valid request type." };
  }

  const { data: created, error } = await supabase
    .from("requests")
    .insert({
      company_id: companyId,
      request_type_id: data.requestTypeId,
      title: data.title,
      description: data.description,
      priority: data.priority,
      due_date: data.dueDate,
      related_deal_id: data.relatedDealId,
      assigned_to_user_id: data.assignedToUserId,
      assigned_to_role: data.assignedToRole,
      created_by: session.user.id,
      status: "pending",
    })
    .select("id")
    .single();
  if (error || !created) {
    return { ok: false, error: "Could not create the request." };
  }

  // Notify the assignee (specific user) or the role-queue members.
  const recipients = data.assignedToUserId
    ? [data.assignedToUserId]
    : data.assignedToRole
      ? await roleQueueUserIds(supabase, companyId, data.assignedToRole)
      : [];
  await notify(
    recipients.map((userId) => ({
      userId,
      actorId: session.user.id,
      kind: "request_assigned" as const,
      payload: {
        request_id: created.id,
        request_title: data.title,
        by_name: session.profile.full_name,
      },
    })),
  );

  await captureServer(
    "request_created",
    {
      request_type: type.name,
      assigned_to_role: data.assignedToRole ?? null,
      // Attachments are uploaded after creation (recordRequestFile), so a brand
      // new request never has them yet.
      has_attachments: false,
      has_due_date: data.dueDate != null,
    },
    session.user.id,
    { company: companyId },
  );

  revalidatePath("/app/requests");
  return { ok: true, requestId: created.id };
}

// ── inline edit ───────────────────────────────────────────────────────────────
export async function updateRequestFields(
  requestId: string,
  input: unknown,
): Promise<RequestActionResult> {
  const session = await getSessionProfile();
  if (!session) return { ok: false, error: "Your session has expired." };
  const parsed = updateRequestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Please fix the form.",
    };
  }
  const v = parsed.data;
  const cols: Record<string, unknown> = {};
  if (v.title !== undefined) cols.title = v.title;
  if ("description" in v) cols.description = v.description;
  if (v.priority !== undefined) cols.priority = v.priority;
  if ("dueDate" in v) cols.due_date = v.dueDate;
  if ("relatedDealId" in v) cols.related_deal_id = v.relatedDealId;
  if ("assignedToUserId" in v) cols.assigned_to_user_id = v.assignedToUserId;
  if ("assignedToRole" in v) cols.assigned_to_role = v.assignedToRole;
  if (Object.keys(cols).length === 0) return { ok: true };

  const supabase = await createClient();
  const before = await loadRequestCore(supabase, requestId);
  const { error } = await supabase
    .from("requests")
    .update(cols)
    .eq("id", requestId);
  if (error) return { ok: false, error: "Could not save your changes." };

  // If the assignee changed to a new specific user, notify them.
  if (
    before &&
    "assigned_to_user_id" in cols &&
    cols.assigned_to_user_id &&
    cols.assigned_to_user_id !== before.assigned_to_user_id
  ) {
    await notify([
      {
        userId: cols.assigned_to_user_id as string,
        actorId: session.user.id,
        kind: "request_assigned",
        payload: {
          request_id: requestId,
          request_title: before.title,
          by_name: session.profile.full_name,
        },
      },
    ]);
  }

  revalidatePath(`/app/requests/${requestId}`);
  revalidatePath("/app/requests");
  return { ok: true };
}

// ── status transition (kanban) ────────────────────────────────────────────────
export async function changeRequestStatus(
  requestId: string,
  input: unknown,
): Promise<RequestActionResult> {
  const session = await getSessionProfile();
  if (!session) return { ok: false, error: "Your session has expired." };
  const parsed = requestStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid status." };
  const to = parsed.data.to as RequestStatus;

  const supabase = await createClient();
  const req = await loadRequestCore(supabase, requestId);
  if (!req) return { ok: false, error: "Request not found." };
  if (req.status === to) return { ok: true };
  const from = req.status;

  const { error } = await supabase
    .from("requests")
    .update({ status: to })
    .eq("id", requestId);
  if (error) return { ok: false, error: "Could not update the status." };

  // Append-only audit trail (F-127).
  await supabase.from("request_status_changes").insert({
    request_id: requestId,
    from_status: from,
    to_status: to,
    changed_by: session.user.id,
    note: parsed.data.note ?? null,
  });
  await logAudit({
    actor_user_id: session.user.id,
    action: "request_status_changed",
    resource_type: "request",
    resource_id: requestId,
    metadata: { from, to },
  });

  // Notify the creator when their request needs attention / is done.
  if (to === "ready_for_review" || to === "completed") {
    await notify([
      {
        userId: req.created_by ?? "",
        actorId: session.user.id,
        kind:
          to === "ready_for_review"
            ? "request_ready_for_review"
            : "request_completed",
        payload: { request_id: requestId, request_title: req.title },
      },
    ]);
  }

  // ── PostHog: request_status_changed (+ request_completed on close) ──────────
  const groups = { company: req.company_id };
  await captureServer(
    "request_status_changed",
    { request_id: requestId, from_status: from, to_status: to },
    session.user.id,
    groups,
  );
  if (to === "completed") {
    const { data: meta } = await supabase
      .from("requests")
      .select("created_at, request_types(name)")
      .eq("id", requestId)
      .maybeSingle();
    const createdAt = meta?.created_at ? Date.parse(meta.created_at) : null;
    const timeOpenHours =
      createdAt !== null ? (Date.now() - createdAt) / 3_600_000 : null;
    // Supabase types the embedded relation as an array; take the first row.
    const rt = meta?.request_types as
      | { name: string }
      | { name: string }[]
      | null
      | undefined;
    const requestTypeName =
      (Array.isArray(rt) ? rt[0]?.name : rt?.name) ?? "unknown";
    await captureServer(
      "request_completed",
      {
        request_type: requestTypeName,
        time_open_hours:
          timeOpenHours !== null ? Math.round(timeOpenHours * 10) / 10 : null,
      },
      session.user.id,
      groups,
    );
  }

  revalidatePath(`/app/requests/${requestId}`);
  revalidatePath("/app/requests");
  return { ok: true };
}

// ── claim a role-queue request ────────────────────────────────────────────────
export async function claimRequest(
  requestId: string,
): Promise<RequestActionResult> {
  const session = await getSessionProfile();
  if (!session) return { ok: false, error: "Your session has expired." };

  const supabase = await createClient();
  const req = await loadRequestCore(supabase, requestId);
  if (!req) return { ok: false, error: "Request not found." };
  if (req.assigned_to_user_id) {
    return { ok: false, error: "This request is already claimed." };
  }

  const moveToInProgress = req.status === "pending";
  const { error } = await supabase
    .from("requests")
    .update({
      assigned_to_user_id: session.user.id,
      ...(moveToInProgress ? { status: "in_progress" as const } : {}),
    })
    .eq("id", requestId);
  if (error) return { ok: false, error: "Could not claim the request." };

  if (moveToInProgress) {
    await supabase.from("request_status_changes").insert({
      request_id: requestId,
      from_status: "pending",
      to_status: "in_progress",
      changed_by: session.user.id,
      note: "Claimed",
    });
  }

  await notify([
    {
      userId: req.created_by ?? "",
      actorId: session.user.id,
      kind: "request_assigned",
      payload: {
        request_id: requestId,
        request_title: req.title,
        by_name: session.profile.full_name,
        claimed: true,
      },
    },
  ]);

  revalidatePath(`/app/requests/${requestId}`);
  revalidatePath("/app/requests");
  return { ok: true };
}

// ── comments (transparency by default — no internal notes) ────────────────────
export async function addRequestComment(
  requestId: string,
  input: unknown,
): Promise<RequestActionResult> {
  const session = await getSessionProfile();
  if (!session) return { ok: false, error: "Your session has expired." };
  const parsed = requestCommentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Write a comment first." };

  const supabase = await createClient();
  const req = await loadRequestCore(supabase, requestId);
  if (!req) return { ok: false, error: "Request not found." };

  const { error } = await supabase.from("request_comments").insert({
    request_id: requestId,
    user_id: session.user.id,
    body: parsed.data.body,
    is_internal: false,
  });
  if (error) return { ok: false, error: "Could not post your comment." };

  // Notify the other party (F-129): creator <-> assignee. For an unclaimed
  // role-queue, notify everyone in that role.
  const me = session.user.id;
  const recipients = new Set<string>();
  if (req.created_by) recipients.add(req.created_by);
  if (req.assigned_to_user_id) recipients.add(req.assigned_to_user_id);
  else if (req.assigned_to_role) {
    for (const id of await roleQueueUserIds(
      supabase,
      req.company_id,
      req.assigned_to_role,
    )) {
      recipients.add(id);
    }
  }
  recipients.delete(me);
  await notify(
    [...recipients].map((userId) => ({
      userId,
      actorId: me,
      kind: "request_new_comment" as const,
      payload: {
        request_id: requestId,
        request_title: req.title,
        by_name: session.profile.full_name,
      },
    })),
  );

  revalidatePath(`/app/requests/${requestId}`);
  return { ok: true };
}

// ── files ─────────────────────────────────────────────────────────────────────
export async function recordRequestFile(
  requestId: string,
  file: {
    storagePath: string;
    originalFilename: string;
    fileSizeBytes: number | null;
    contentType: string | null;
  },
): Promise<RequestActionResult<{ fileId: string }>> {
  const session = await getSessionProfile();
  if (!session) return { ok: false, error: "Your session has expired." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("request_files")
    .insert({
      request_id: requestId,
      storage_path: file.storagePath,
      original_filename: file.originalFilename,
      file_size_bytes: file.fileSizeBytes,
      content_type: file.contentType,
      uploaded_by: session.user.id,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "Could not save the file." };
  revalidatePath(`/app/requests/${requestId}`);
  return { ok: true, fileId: data.id };
}

export async function deleteRequestFile(
  fileId: string,
): Promise<RequestActionResult> {
  const session = await getSessionProfile();
  if (!session) return { ok: false, error: "Your session has expired." };
  const supabase = await createClient();
  const { data: file } = await supabase
    .from("request_files")
    .select("id, request_id, storage_path")
    .eq("id", fileId)
    .single();
  if (!file) return { ok: false, error: "File not found." };

  const { error } = await supabase
    .from("request_files")
    .delete()
    .eq("id", fileId);
  if (error) return { ok: false, error: "Could not delete the file." };
  await supabase.storage.from("request-files").remove([file.storage_path]);

  revalidatePath(`/app/requests/${file.request_id}`);
  return { ok: true };
}

// ── soft delete ───────────────────────────────────────────────────────────────
export async function softDeleteRequest(
  requestId: string,
): Promise<RequestActionResult> {
  const session = await getSessionProfile();
  if (!session) return { ok: false, error: "Your session has expired." };

  const supabase = await createClient();
  const req = await loadRequestCore(supabase, requestId);
  if (!req) return { ok: false, error: "Request not found." };

  const isCreator = req.created_by === session.user.id;
  if (!canDeleteRequest(session.profile.role, isCreator)) {
    return { ok: false, error: "You can't delete this request." };
  }

  const { error } = await supabase
    .from("requests")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", requestId);
  if (error) return { ok: false, error: "Could not delete the request." };

  await logAudit({
    actor_user_id: session.user.id,
    action: "request_deleted",
    resource_type: "request",
    resource_id: requestId,
    metadata: { title: req.title } as Record<string, Json>,
  });

  revalidatePath("/app/requests");
  return { ok: true };
}

// ── notifications ─────────────────────────────────────────────────────────────
/** Mark all of the current user's unread notifications as read (bell badge). */
export async function markAllNotificationsRead(): Promise<RequestActionResult> {
  const session = await getSessionProfile();
  if (!session) return { ok: false, error: "Your session has expired." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", session.user.id)
    .is("read_at", null);
  if (error) return { ok: false, error: "Could not update notifications." };
  revalidatePath("/app", "layout");
  return { ok: true };
}
