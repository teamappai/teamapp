import Link from "next/link";

import { cn } from "@/lib/utils/index";
import { formatPercent } from "@/lib/utils/format";
import type { OnboardingProgress } from "@/lib/training/progress";

/**
 * Agent-only onboarding progress widget (sidebar bottom). Renders
 * "X of Y modules complete (NN%)" with an integer percent (audit F-118) and a
 * progress bar. Clicking it goes to /app/training. Only mount this for agents —
 * other roles must not see a "0 of 0" version.
 */
export function OnboardingWidget({
  progress,
  onNavigate,
}: {
  progress: OnboardingProgress;
  onNavigate?: () => void;
}) {
  const { completed, total, percent } = progress;

  return (
    <Link
      href="/app/training"
      onClick={onNavigate}
      className={cn(
        "border-sidebar-border bg-sidebar-accent/40 block rounded-lg border p-3 transition-colors outline-none",
        "hover:bg-sidebar-accent focus-visible:ring-sidebar-ring focus-visible:ring-2",
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sidebar-foreground text-xs font-medium">
          Onboarding
        </span>
        <span className="text-sidebar-foreground text-xs font-semibold">
          {formatPercent(percent)}
        </span>
      </div>
      <div
        className="bg-sidebar-border mt-2 h-1.5 w-full overflow-hidden rounded-full"
        role="progressbar"
        aria-label="Onboarding progress"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="bg-primary h-full rounded-full transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-sidebar-foreground/70 mt-2 text-xs">
        {completed} of {total} modules complete
      </p>
    </Link>
  );
}
