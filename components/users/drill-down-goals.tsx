"use client";

import * as React from "react";

import type { GoalProgress } from "@/lib/coaching/queries";
import { GoalProgressBar } from "@/components/coaching/goal-progress-bar";
import { GoalsDrawer } from "@/components/coaching/goals-drawer";
import { Button } from "@/components/ui/button";

/**
 * Current goals on the Overview tab with an inline editor (Decision 14). Only
 * shown editable to team_lead / super_admin; admin_tc sees read-only progress.
 */
export function DrillDownGoals({
  goals,
  agent,
  canEdit,
}: {
  goals: GoalProgress[];
  agent: { id: string; name: string };
  canEdit: boolean;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="space-y-3">
      {goals.length === 0 ? (
        <p className="text-muted-foreground text-sm">No goals set.</p>
      ) : (
        <div className="space-y-3">
          {goals.map((g) => (
            <GoalProgressBar key={g.id} goal={g} showSetBy={false} />
          ))}
        </div>
      )}
      {canEdit ? (
        <>
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            {goals.length > 0 ? "Edit goals" : "Set a goal"}
          </Button>
          <GoalsDrawer
            open={open}
            onOpenChange={setOpen}
            agentName={agent.name}
            userId={agent.id}
            goals={goals}
            defaultCategory="outcome"
          />
        </>
      ) : null}
    </div>
  );
}
