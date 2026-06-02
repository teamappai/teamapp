import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getSessionProfile } from "@/lib/auth/profile";
import {
  listPublishedPlaybooks,
  listOnboardingPlaybooks,
} from "@/lib/playbooks/playbooks";
import {
  listInstalledPlaybookIds,
  listInstalledPlaybooks,
} from "@/lib/playbooks/installs";
import { PageHeader } from "@/components/shared/page-header";
import { PlaybookBrowse } from "@/components/playbooks/playbook-browse";
import { RecommendedPlaybooks } from "@/components/playbooks/recommended-playbooks";

export const metadata: Metadata = { title: "Playbooks · TeamApp" };

export default async function PlaybooksPage() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");

  const { role, company_id: companyId } = session.profile;
  // Only team_lead and admin_tc can browse + install (Decision: customer roles).
  if ((role !== "team_lead" && role !== "admin_tc") || !companyId) {
    redirect("/app/dashboard");
  }

  const [playbooks, installedIdSet, installed] = await Promise.all([
    listPublishedPlaybooks(),
    listInstalledPlaybookIds(companyId),
    listInstalledPlaybooks(companyId),
  ]);
  const installedIds = [...installedIdSet];

  // When the team has nothing installed yet, surface a "get started" set of
  // recommended playbooks (onboarding integration — Decision 6).
  const recommended =
    installed.length === 0 ? await listOnboardingPlaybooks() : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Install proven playbooks from top operators"
        description="Get started with curated training content. Customize anything after installing."
      />
      {recommended.length > 0 && (
        <RecommendedPlaybooks
          playbooks={recommended}
          installedIds={installedIds}
        />
      )}
      <PlaybookBrowse
        playbooks={playbooks}
        installedIds={installedIds}
        installed={installed}
      />
    </div>
  );
}
