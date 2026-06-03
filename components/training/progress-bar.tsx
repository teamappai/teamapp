import { cn } from "@/lib/utils/index";

/** Thin accessible progress bar used across the training surfaces. */
export function ProgressBar({
  percent,
  className,
  label = "Progress",
}: {
  percent: number;
  className?: string;
  /** Accessible name for the progressbar (WCAG aria-progressbar-name). */
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div
      className={cn(
        "bg-muted h-2 w-full overflow-hidden rounded-full",
        className,
      )}
      role="progressbar"
      aria-label={label}
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="bg-primary h-full rounded-full transition-all"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
