"use client";

import * as React from "react";
import { Sparkles, X } from "lucide-react";

import type { PlaybookWithCounts } from "@/lib/playbooks/playbooks";
import { PlaybookCover } from "@/components/playbooks/playbook-cover";
import { InstallControls } from "@/components/playbooks/install-controls";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * "Get started with TeamApp playbooks" — the onboarding surface (Decision 6).
 * Renders up to 3 recommended playbooks with an Install action each, plus a Skip
 * that never blocks. Reusable in a company-setup step; here it appears on the
 * playbook browser when the team has nothing installed yet. Installing stays on
 * the page (router.refresh) so a team can install more than one.
 */
export function RecommendedPlaybooks({
  playbooks,
  installedIds,
}: {
  playbooks: PlaybookWithCounts[];
  installedIds: string[];
}) {
  const [dismissed, setDismissed] = React.useState(false);
  const installedSet = React.useMemo(
    () => new Set(installedIds),
    [installedIds],
  );
  if (dismissed || playbooks.length === 0) return null;

  return (
    <Card className="bg-muted/40 gap-4 p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            <Sparkles className="text-primary size-4" />
            Get started with TeamApp playbooks
          </h2>
          <p className="text-muted-foreground text-sm">
            Install a curated playbook to give your team a head start. You can
            customize everything afterward.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDismissed(true)}
          aria-label="Skip"
        >
          <X className="size-4" /> Skip
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {playbooks.map((p) => (
          <Card key={p.id} className="flex flex-col gap-3 overflow-hidden p-0">
            <PlaybookCover
              iconName={p.icon_name}
              gradient={p.cover_gradient}
              className="rounded-b-none"
            />
            <div className="flex flex-1 flex-col gap-2 p-4 pt-0">
              <h3 className="font-semibold">{p.title}</h3>
              {p.description && (
                <p className="text-muted-foreground line-clamp-2 text-sm">
                  {p.description}
                </p>
              )}
              <div className="mt-auto pt-1">
                <InstallControls
                  playbookId={p.id}
                  sectionsCount={p.sectionCount}
                  modulesCount={p.moduleCount}
                  alreadyInstalled={installedSet.has(p.id)}
                  redirectTo="/app/playbooks"
                  className="w-full"
                />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </Card>
  );
}
