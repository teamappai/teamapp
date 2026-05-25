import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils/index";

type EmptyStateProps = {
  /** Icon for the zero-data illustration. */
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** Primary next-action (usually a Button). Sell the next step. */
  action?: React.ReactNode;
  className?: string;
};

/**
 * Standard zero-data view. Every list/table that can be empty should render
 * this instead of a blank area — and point the user at their next action.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-12 text-center",
        className,
      )}
    >
      {Icon ? (
        <div className="bg-muted text-muted-foreground mb-4 flex size-12 items-center justify-center rounded-full">
          <Icon className="size-6" aria-hidden />
        </div>
      ) : null}
      <h3 className="text-sm font-semibold">{title}</h3>
      {description ? (
        <p className="text-muted-foreground mt-1 max-w-sm text-sm">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
