import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Layers } from "lucide-react";

import { getSessionProfile } from "@/lib/auth/profile";
import { getPublishedPlaybookToc } from "@/lib/playbooks/playbooks";
import {
  listInstalledPlaybookIds,
  checkInstallCap,
} from "@/lib/playbooks/installs";
import { logAudit } from "@/lib/audit/log";
import { INSTALL_COUNT_CREDIBILITY_THRESHOLD } from "@/lib/constants/playbooks";
import { getPlan } from "@/lib/billing/plans";
import { PlaybookCover } from "@/components/playbooks/playbook-cover";
import { InstallControls } from "@/components/playbooks/install-controls";
import { StatusChip } from "@/components/shared/status-chip";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Playbook · TeamApp" };

export default async function PlaybookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  const { role, company_id: companyId, id: userId } = session.profile;

  // team_lead + admin_tc get the full installable view; super_admin gets a
  // read-only "preview as customer"; everyone else is bounced to the dashboard.
  const isInstaller = role === "team_lead" || role === "admin_tc";
  if (!isInstaller && role !== "super_admin") {
    redirect("/app/dashboard");
  }

  const { id } = await params;
  const toc = await getPublishedPlaybookToc(id);
  if (!toc) notFound();
  const { playbook, sectionCount, moduleCount, sections } = toc;

  let alreadyInstalled = false;
  let capLine: string | null = null;
  if (isInstaller && companyId) {
    const installedIds = await listInstalledPlaybookIds(companyId);
    alreadyInstalled = installedIds.has(id);

    // Analytics: record the view (PostHog hook lands in Phase 15).
    await logAudit({
      actor_user_id: userId,
      action: "playbook_viewed",
      resource_type: "playbook",
      resource_id: id,
      metadata: { playbook_id: id },
    });

    // Plan-limit indicator for Launch teams near their cap.
    const cap = await checkInstallCap(companyId);
    if (cap.cap !== -1 && !alreadyInstalled) {
      capLine = `You've installed ${cap.current} of ${cap.cap} ${getPlan(cap.planName).display_name} plan playbooks.`;
    }
  }

  const showInstallCount =
    playbook.install_count > INSTALL_COUNT_CREDIBILITY_THRESHOLD;

  return (
    <div className="space-y-6">
      <Link
        href="/app/playbooks"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Playbook Library
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Main */}
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <PlaybookCover
              iconName={playbook.icon_name}
              gradient={playbook.cover_gradient}
              size="lg"
              className="sm:w-40"
            />
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {playbook.title}
              </h1>
              <StatusChip variant="info" hideDot className="self-start">
                {playbook.category}
              </StatusChip>
              {playbook.credit_text && (
                <p className="text-muted-foreground text-sm">
                  {playbook.credit_text}
                </p>
              )}
            </div>
          </div>

          {playbook.description && (
            <p className="text-sm leading-relaxed">{playbook.description}</p>
          )}

          <div className="space-y-3">
            <h2 className="flex items-center gap-2 font-semibold">
              <Layers className="text-muted-foreground size-4" />
              What&apos;s included
            </h2>
            <p className="text-muted-foreground text-sm">
              {sectionCount} training section{sectionCount === 1 ? "" : "s"} ·{" "}
              {moduleCount} module{moduleCount === 1 ? "" : "s"}
            </p>
            <ol className="space-y-2">
              {sections.map((s, i) => (
                <li key={s.id} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      {i + 1}. {s.title}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {s.moduleCount} module{s.moduleCount === 1 ? "" : "s"}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <Card className="gap-3 p-5">
            {isInstaller ? (
              <InstallControls
                playbookId={id}
                sectionsCount={sectionCount}
                modulesCount={moduleCount}
                alreadyInstalled={alreadyInstalled}
                className="w-full"
              />
            ) : (
              <p className="text-muted-foreground text-sm">
                Preview mode — super admins can&apos;t install playbooks.
              </p>
            )}
            {showInstallCount && (
              <p className="text-muted-foreground text-center text-xs">
                {playbook.install_count} teams use this playbook
              </p>
            )}
            {capLine && (
              <p className="text-muted-foreground border-t pt-3 text-center text-xs">
                {capLine}
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
