import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getSessionProfile } from "@/lib/auth/profile";
import { NotAuthorizedError } from "@/lib/auth/require-super-admin";
import { createClient } from "@/lib/supabase/server";
import { canViewDeals, canDeleteDeals } from "@/lib/deals/access";
import {
  getDealById,
  listDealActivity,
  listDealComments,
  listDealFiles,
  listStages,
  listCompanyUsers,
  signDealFileUrls,
  primaryAgent,
} from "@/lib/deals/queries";
import { formatDealId } from "@/lib/deals/format";
import { DealDetail } from "@/components/deals/deal-detail";

export const metadata: Metadata = { title: "Deal · TeamApp" };

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSessionProfile();
  if (!session || !canViewDeals(session.profile.role)) {
    throw new NotAuthorizedError();
  }
  const { id } = await params;

  const deal = await getDealById(id);
  if (!deal) notFound();

  const me = session.user.id;
  const role = session.profile.role;
  const involvesMe =
    deal.created_by === me ||
    deal.listing_agent_id === me ||
    deal.co_listing_agent_id === me ||
    deal.buyer_agent_id === me;
  // Mirror the deals_update RLS policy so inline edits never fail server-side.
  const canEdit = role === "super_admin" || role === "team_lead" || involvesMe;
  const canManage = role === "super_admin" || role === "team_lead";

  const [files, activity, comments, stages, users] = await Promise.all([
    listDealFiles(id),
    listDealActivity(id),
    listDealComments(id),
    listStages(deal.company_id),
    listCompanyUsers(deal.company_id),
  ]);

  const supabase = await createClient();
  const fileUrls = await signDealFileUrls(
    supabase,
    files.map((f) => ({ id: f.id, storage_path: f.storage_path })),
  );

  return (
    <DealDetail
      deal={deal}
      displayId={formatDealId(deal.id)}
      primaryAgentName={primaryAgent(deal)?.full_name ?? null}
      stages={stages.map((s) => ({
        id: s.id,
        name: s.name,
        is_terminal_won: s.is_terminal_won,
        is_terminal_lost: s.is_terminal_lost,
      }))}
      agents={users.map((u) => ({ id: u.id, name: u.full_name ?? "Unnamed" }))}
      files={files.map((f) => ({
        id: f.id,
        name: f.original_filename,
        sizeBytes: f.file_size_bytes,
        uploadedAt: f.uploaded_at,
        uploaderName: f.uploader?.full_name ?? null,
        uploadedByMe: f.uploaded_by === me,
        url: fileUrls[f.id] ?? null,
      }))}
      activity={activity.map((a) => ({
        id: a.id,
        event: a.event_type,
        payload: a.payload as Record<string, unknown>,
        actorName: a.actor?.full_name ?? null,
        createdAt: a.created_at,
      }))}
      comments={comments.map((c) => ({
        id: c.id,
        body: c.body,
        parentId: c.parent_id,
        authorName: c.author?.full_name ?? null,
        authorAvatar: c.author?.avatar_url ?? null,
        authorId: c.user_id,
        createdAt: c.created_at,
      }))}
      currentUserId={me}
      currentUserCompanyId={session.profile.company_id}
      canEdit={canEdit}
      canManage={canManage}
      canDelete={canDeleteDeals(role)}
    />
  );
}
