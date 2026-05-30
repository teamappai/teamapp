import type { Metadata } from "next";
import Link from "next/link";

import { getSessionProfile } from "@/lib/auth/profile";
import { NotAuthorizedError } from "@/lib/auth/require-super-admin";
import {
  canCreateRequests,
  canViewRequests,
  resolveTab,
  tabsForRole,
} from "@/lib/requests/access";
import { listRequestsForScope } from "@/lib/requests/queries";
import { listCompanyUsers } from "@/lib/deals/queries";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import {
  RequestsTable,
  type RequestListItem,
} from "@/components/requests/requests-table";

export const metadata: Metadata = { title: "Requests · TeamApp" };

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getSessionProfile();
  if (!session || !canViewRequests(session.profile.role)) {
    throw new NotAuthorizedError();
  }
  const role = session.profile.role;
  const companyId = session.profile.company_id;
  const me = session.user.id;
  const { tab } = await searchParams;
  const initialTab = resolveTab(role, tab);

  const [requests, members] = await Promise.all([
    listRequestsForScope({ role, companyId, userId: me }),
    listCompanyUsers(companyId),
  ]);

  const items: RequestListItem[] = requests.map((r) => {
    const assignedToMe = r.assigned_to_user_id === me;
    const roleQueueMine =
      r.assigned_to_role === role && r.assigned_to_user_id === null;
    const inMyQueue = assignedToMe || roleQueueMine;
    return {
      id: r.id,
      title: r.title,
      typeId: r.request_type_id,
      typeName: r.request_type?.name ?? "—",
      category: r.request_type?.category ?? "other",
      typeRole: r.request_type?.default_assignee_role ?? null,
      status: r.status,
      priority: r.priority,
      assigneeId: r.assigned_to_user_id,
      assigneeName: r.assignee?.full_name ?? null,
      assigneeAvatar: r.assignee?.avatar_url ?? null,
      assignedToRole: r.assigned_to_role,
      unclaimed: !!r.assigned_to_role && r.assigned_to_user_id === null,
      creatorId: r.created_by,
      creatorName: r.creator?.full_name ?? null,
      dueDate: r.due_date,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      mine: r.created_by === me,
      inMyQueue,
    };
  });

  // The full set of types present in the visible requests (for the Type filter).
  const typeMap = new Map<string, string>();
  for (const r of requests) {
    if (r.request_type) typeMap.set(r.request_type.id, r.request_type.name);
  }
  const types = [...typeMap.entries()].map(([id, name]) => ({ id, name }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Requests"
        description="Track marketing and operational requests for your team."
        action={
          canCreateRequests(role) ? (
            <Button asChild>
              <Link href="/app/requests/new">+ New Request</Link>
            </Button>
          ) : undefined
        }
      />

      <RequestsTable
        items={items}
        role={role}
        initialTab={initialTab}
        tabs={tabsForRole(role)}
        types={types}
        members={members.map((u) => ({
          id: u.id,
          name: u.full_name ?? "Unnamed",
        }))}
      />
    </div>
  );
}
