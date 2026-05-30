import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { getSessionProfile } from "@/lib/auth/profile";
import { NotAuthorizedError } from "@/lib/auth/require-super-admin";
import { createClient } from "@/lib/supabase/server";
import {
  canViewRequests,
  canManageRequests,
  canDeleteRequest,
} from "@/lib/requests/access";
import {
  getRequestById,
  listRequestComments,
  listRequestFiles,
  listRequestStatusChanges,
  signRequestFileUrls,
} from "@/lib/requests/queries";
import { listCompanyUsers } from "@/lib/deals/queries";
import { RequestDetail } from "@/components/requests/request-detail";

export const metadata: Metadata = { title: "Request · TeamApp" };

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSessionProfile();
  if (!session || !canViewRequests(session.profile.role)) {
    throw new NotAuthorizedError();
  }
  const { id } = await params;
  const me = session.user.id;
  const role = session.profile.role;

  const request = await getRequestById(id);
  if (!request) notFound();

  const isCreator = request.created_by === me;
  const isAssignee = request.assigned_to_user_id === me;
  const isManager = canManageRequests(role);

  // Marketing narrowing (F-133): they may only open requests assigned to them,
  // in the marketing queue, or whose type routes to marketing (IDOR guard).
  if (role === "marketing") {
    const allowed =
      isAssignee ||
      request.assigned_to_role === "marketing" ||
      request.request_type?.default_assignee_role === "marketing";
    // Friendly bounce rather than a hard error — marketing simply can't see
    // requests outside their domain (F-133 IDOR guard).
    if (!allowed) redirect("/app/requests");
  }

  const [comments, files, statusChanges, members] = await Promise.all([
    listRequestComments(id),
    listRequestFiles(id),
    listRequestStatusChanges(id),
    listCompanyUsers(request.company_id),
  ]);

  const supabase = await createClient();
  const fileUrls = await signRequestFileUrls(
    supabase,
    files.map((f) => ({ id: f.id, storage_path: f.storage_path })),
  );

  const canEdit = isCreator || isManager;
  const canClaim =
    !!request.assigned_to_role &&
    request.assigned_to_user_id === null &&
    (request.assigned_to_role === role || isManager);

  return (
    <RequestDetail
      request={{
        id: request.id,
        title: request.title,
        description: request.description,
        status: request.status,
        priority: request.priority,
        typeName: request.request_type?.name ?? "—",
        category: request.request_type?.category ?? "other",
        dueDate: request.due_date,
        createdAt: request.created_at,
        creatorName: request.creator?.full_name ?? null,
        creatorId: request.created_by,
        assigneeId: request.assigned_to_user_id,
        assigneeName: request.assignee?.full_name ?? null,
        assigneeAvatar: request.assignee?.avatar_url ?? null,
        assignedToRole: request.assigned_to_role,
        relatedDealId: request.related_deal_id,
        relatedDealLabel: request.related_deal?.property_address ?? null,
      }}
      comments={comments.map((c) => ({
        id: c.id,
        body: c.body,
        authorName: c.author?.full_name ?? null,
        authorAvatar: c.author?.avatar_url ?? null,
        authorRole: c.author?.role ?? null,
        authorId: c.user_id,
        createdAt: c.created_at,
      }))}
      files={files.map((f) => ({
        id: f.id,
        name: f.original_filename,
        sizeBytes: f.file_size_bytes,
        uploadedAt: f.uploaded_at,
        uploaderName: f.uploader?.full_name ?? null,
        uploadedByMe: f.uploaded_by === me,
        url: fileUrls[f.id] ?? null,
      }))}
      statusChanges={statusChanges.map((s) => ({
        id: s.id,
        from: s.from_status,
        to: s.to_status,
        changerName: s.changer?.full_name ?? null,
        createdAt: s.created_at,
      }))}
      members={members.map((u) => ({
        id: u.id,
        name: u.full_name ?? "Unnamed",
        avatarUrl: u.avatar_url,
        role: u.role,
      }))}
      currentUserId={me}
      currentUserCompanyId={request.company_id}
      canEdit={canEdit}
      canManage={isManager}
      canDelete={canDeleteRequest(role, isCreator)}
      canClaim={canClaim}
    />
  );
}
