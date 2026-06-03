import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getSessionProfile } from "@/lib/auth/profile";
import { canCreateDeals } from "@/lib/deals/access";
import { listCompanyUsers, listDealTypes } from "@/lib/deals/queries";
import { PageHeader } from "@/components/shared/page-header";
import { DealWizard } from "@/components/deals/deal-wizard";
import { TrackOnMount } from "@/components/posthog/track-on-mount";
import type { EventMap } from "@/lib/posthog/types";

export const metadata: Metadata = { title: "New Deal · TeamApp" };

/** Normalize the ?source= query param to a known deal_form_opened source. */
function dealSource(raw?: string): EventMap["deal_form_opened"]["source"] {
  if (raw === "ai_upload" || raw === "dashboard_quick_action") return raw;
  return "add_button";
}

export default async function NewDealPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string }>;
}) {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  // super_admin is intentionally excluded (F-031 — ambiguous ownership).
  if (!canCreateDeals(session.profile.role)) {
    redirect("/app/deals");
  }
  const companyId = session.profile.company_id;
  const { source } = await searchParams;

  const [users, dealTypes] = await Promise.all([
    listCompanyUsers(companyId),
    listDealTypes(companyId),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <TrackOnMount
        event="deal_form_opened"
        properties={{ source: dealSource(source) }}
      />
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
