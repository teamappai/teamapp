import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getSessionProfile } from "@/lib/auth/profile";
import { canCreateRequests } from "@/lib/requests/access";
import { listRequestTypesForCompany } from "@/lib/requests/queries";
import { listCompanyUsers, listDealsForScope } from "@/lib/deals/queries";
import { PageHeader } from "@/components/shared/page-header";
import { RequestForm } from "@/components/requests/request-form";

export const metadata: Metadata = { title: "New Request · TeamApp" };

export default async function NewRequestPage() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  // Marketing is fulfill-only (F-136).
  if (!canCreateRequests(session.profile.role)) {
    redirect("/app/requests");
  }
  const companyId = session.profile.company_id;
  const me = session.user.id;
  const role = session.profile.role;

  const [types, members, deals] = await Promise.all([
    listRequestTypesForCompany(companyId),
    listCompanyUsers(companyId),
    listDealsForScope({ role, companyId, userId: me }),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="New Request"
        description="Ask a teammate to handle a marketing or operational task."
      />
      <RequestForm
        companyId={companyId}
        types={(
          types.filter(Boolean) as NonNullable<(typeof types)[number]>[]
        ).map((t) => ({
          id: t.id,
          name: t.name,
          defaultAssigneeRole: t.default_assignee_role,
          category: t.category,
        }))}
        members={members.map((u) => ({
          id: u.id,
          name: u.full_name ?? "Unnamed",
          avatarUrl: u.avatar_url,
          role: u.role,
        }))}
        deals={deals.map((d) => ({
          id: d.id,
          label:
            d.property_address ||
            [d.client_first_name, d.client_last_name]
              .filter(Boolean)
              .join(" ") ||
            "Untitled deal",
        }))}
      />
    </div>
  );
}
