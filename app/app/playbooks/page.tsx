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
import { EmptyState } from "@/components/shared/empty-state";
import { BookOpen } from "lucide-react";
import { TrackOnMount } from "@/components/posthog/track-on-mount";
import { isFlagEnabled } from "@/lib/flags";

export const metadata: Metadata = { title: "Playbooks · TeamApp" };

export default async function PlaybooksPage() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");

  const { role, company_id: companyId } = session.profile;
  // Only team_lead and admin_tc can browse + install (Decision: customer roles).
  if ((role !== "team_lead" && role !== "admin_tc") || !companyId) {
    redirect("/app/dashboard");
  }

  // Kill switch for the Phase 12.5 playbook library (Phase 15 §G, J7). Hybrid
  // resolver: DB feature_flags first, then PostHog. Default ON.
  const libraryEnabled = await isFlagEnabled("flag_show_playbook_library", {
    userId: session.user.id,
    companyId,
  });
  if (!libraryEnabled) {
    return (
      <div className="space-y-6">
        <PageHeader title="Playbooks" />
        <EmptyState
          icon={BookOpen}
          title="Coming soon"
          description="The playbook library isn't available for your team yet. Check back shortly."
        />
      </div>
    );
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
      <TrackOnMount
        event="playbook_browsed"
        properties={{
          source: recommended.length > 0 ? "onboarding" : "library",
        }}
      />
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
