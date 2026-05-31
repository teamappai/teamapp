import type { GoalProgress } from "@/lib/coaching/queries";
import { Card, CardContent } from "@/components/ui/card";
import { GoalProgressBar } from "@/components/coaching/goal-progress-bar";
import { EmptyState } from "@/components/shared/empty-state";
import { Target } from "lucide-react";

/**
 * Team Goals vs Actuals (PA-6): for team-wide goals (user_id IS NULL), the
 * target + current with a progress bar each, plus a headline of overall pace.
 */
export function GoalsVsActuals({ teamGoals }: { teamGoals: GoalProgress[] }) {
  const headlinePct =
    teamGoals.length === 0
      ? 0
      : Math.round(teamGoals.reduce((s, g) => s + g.pct, 0) / teamGoals.length);

  return (
    <Card className="gap-0 py-4">
      <CardContent className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold">Team goals</h2>
          {teamGoals.length > 0 ? (
            <p className="text-muted-foreground text-xs">
              Team is {headlinePct}% to goal this period
            </p>
          ) : null}
        </div>
        {teamGoals.length === 0 ? (
          <EmptyState
            icon={Target}
            title="No team goals yet"
            description="Set a team-wide goal to track collective pace."
          />
        ) : (
          <div className="space-y-4">
            {teamGoals.map((g) => (
              <GoalProgressBar key={g.id} goal={g} showSetBy={false} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
