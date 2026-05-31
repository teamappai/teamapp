"use client";

import * as React from "react";
import { toast } from "sonner";

import { setLeaderboardVisibilityAction } from "@/app/app/management/actions";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

/**
 * Company Settings sub-section of the Management Hub. For now a single toggle:
 * whether agents can see the full team leaderboard on /app/coaching (Phase 10).
 */
export function CompanySettingsTab({
  leaderboardVisibleToAgents,
}: {
  leaderboardVisibleToAgents: boolean;
}) {
  const [enabled, setEnabled] = React.useState(leaderboardVisibleToAgents);
  const [pending, startTransition] = React.useTransition();

  function toggle(next: boolean) {
    const prev = enabled;
    setEnabled(next); // optimistic
    startTransition(async () => {
      const res = await setLeaderboardVisibilityAction(next);
      if (!res.ok) {
        setEnabled(prev);
        toast.error(res.error);
        return;
      }
      toast.success("Company settings updated");
    });
  }

  return (
    <Card className="gap-0 py-0">
      <CardContent className="flex items-start justify-between gap-4 p-4">
        <div className="space-y-0.5">
          <p className="font-medium">Show leaderboard to all agents</p>
          <p className="text-muted-foreground text-sm">
            When enabled, agents see the full team leaderboard with
            everyone&apos;s metrics. When disabled, agents see only their own
            numbers and goals.
          </p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={toggle}
          disabled={pending}
          aria-label="Show leaderboard to all agents"
        />
      </CardContent>
    </Card>
  );
}
