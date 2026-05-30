import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getSessionProfile } from "@/lib/auth/profile";
import { canCreateDeals } from "@/lib/deals/access";
import { listCompanyUsers, listDealTypes } from "@/lib/deals/queries";
import { PageHeader } from "@/components/shared/page-header";
import { DealWizard } from "@/components/deals/deal-wizard";

export const metadata: Metadata = { title: "New Deal · TeamApp" };

export default async function NewDealPage() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  // super_admin is intentionally excluded (F-031 — ambiguous ownership).
  if (!canCreateDeals(session.profile.role)) {
    redirect("/app/deals");
  }
  const companyId = session.profile.company_id;

  const [users, dealTypes] = await Promise.all([
    listCompanyUsers(companyId),
    listDealTypes(companyId),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Add a new deal"
        description="Upload a contract to pre-fill, or enter details manually."
      />
      <DealWizard
        agents={users.map((u) => ({
          id: u.id,
          name: u.full_name ?? "Unnamed",
        }))}
        dealTypes={dealTypes}
      />
    </div>
  );
}
