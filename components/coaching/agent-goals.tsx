"use client";

import * as React from "react";
import { Plus, Target } from "lucide-react";

import type { GoalProgress } from "@/lib/coaching/queries";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { GoalProgressBar } from "@/components/coaching/goal-progress-bar";
import { GoalsDrawer } from "@/components/coaching/goals-drawer";

/**
 * An agent's own goals (PA-6): progress bars plus add/edit via the shared
 * drawer. Outcome goals (GCI, volume, deals) are the default here.
 */
export function AgentGoals({
  userId,
  agentName,
  goals,
}: {
  userId: string;
  agentName: string;
  goals: GoalProgress[];
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <Card className="gap-0 py-4">
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">My goals</h2>
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Add / edit
          </Button>
        </div>

        {goals.length === 0 ? (
          <EmptyState
            icon={Target}
            title="No goals yet"
            description="Set an outcome goal (GCI, volume, or transactions) to track your pace."
            action={
              <Button size="sm" onClick={() => setOpen(true)}>
                <Plus className="size-4" /> Add a goal
              </Button>
            }
          />
        ) : (
          <div className="space-y-4">
            {goals.map((g) => (
              <GoalProgressBar key={g.id} goal={g} />
            ))}
          </div>
        )}
      </CardContent>

      <GoalsDrawer
        open={open}
        onOpenChange={setOpen}
        agentName={agentName}
        userId={userId}
        goals={goals}
        defaultCategory="outcome"
      />
    </Card>
  );
}
