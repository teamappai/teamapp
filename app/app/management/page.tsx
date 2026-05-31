import type { Metadata } from "next";

import { requireTeamLead } from "@/lib/auth/require-team-lead";
import { listSections } from "@/lib/team/sections";
import { listModules } from "@/lib/team/modules";
import {
  listDealTypes,
  listDealStages,
  listRequestTypes,
  getCompanySettings,
} from "@/lib/team/config";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Settings } from "lucide-react";
import { ManagementHub } from "@/components/team/management-hub";
import { resolveHubTab } from "@/lib/team/hub-tabs";

export const metadata: Metadata = { title: "Management Hub · TeamApp" };

const HUB_DESCRIPTION =
  "Sections group your training content. Each Section contains Modules (individual lessons). Configure the deal and request types your team uses.";

export default async function ManagementPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { companyId } = await requireTeamLead();
  const sp = await searchParams;
  const activeTab = resolveHubTab(sp.tab);

  // super_admin has no company — the Management Hub is company-scoped config.
  if (!companyId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Management Hub" description={HUB_DESCRIPTION} />
        <EmptyState
          icon={Settings}
          title="Company-scoped"
          description="The Management Hub manages a single team's content and config. Switch to a company (or impersonate a team lead) to use it."
        />
      </div>
    );
  }

  const [sections, modules, dealTypes, dealStages, requestTypes, settings] =
    await Promise.all([
      listSections(companyId),
      listModules(companyId),
      listDealTypes(companyId),
      listDealStages(companyId),
      listRequestTypes(companyId),
      getCompanySettings(companyId),
    ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Management Hub" description={HUB_DESCRIPTION} />
      <ManagementHub
        companyId={companyId}
        activeTab={activeTab}
        sections={sections}
        modules={modules}
        dealTypes={dealTypes}
        dealStages={dealStages}
        requestTypes={requestTypes}
        leaderboardVisibleToAgents={settings.leaderboardVisibleToAgents}
      />
    </div>
  );
}
