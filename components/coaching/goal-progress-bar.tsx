import type { GoalProgress } from "@/lib/coaching/queries";
import { GOAL_PERIOD_LABELS } from "@/lib/coaching/goals";
import { cn } from "@/lib/utils/index";

/** A single goal row: label, period, set-by, target/actual, and a progress bar. */
export function GoalProgressBar({
  goal,
  showSetBy = true,
  className,
}: {
  goal: GoalProgress;
  showSetBy?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{goal.label}</span>
        <span className="text-muted-foreground tabular-nums">
          {goal.actualDisplay}{" "}
          <span className="text-muted-foreground/70">
            / {goal.targetDisplay}
          </span>
        </span>
      </div>
      <div className="bg-muted h-2 overflow-hidden rounded-full">
        <div
          className="bg-primary h-full rounded-full transition-all"
          style={{ width: `${goal.pct}%` }}
        />
      </div>
      <div className="text-muted-foreground flex items-center justify-between text-xs">
        <span>
          {GOAL_PERIOD_LABELS[goal.period]} · {goal.pct}%
        </span>
        {showSetBy && goal.setByName ? (
          <span>Set by {goal.setByName}</span>
        ) : null}
      </div>
    </div>
  );
}
