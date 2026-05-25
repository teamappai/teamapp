import { cn } from "@/lib/utils/index";

type PageHeaderProps = {
  /**
   * Page title. MUST be role-aware where data scope differs (audit F-025) —
   * compute it in the page (e.g. "All Deals" vs "My Deals") and pass it here.
   */
  title: string;
  description?: string;
  /**
   * Slot for a date-range filter on analytics pages (audit F-019, e.g.
   * Coaching). Rendered between the title block and the primary action.
   */
  dateRange?: React.ReactNode;
  /** Primary action slot (usually a Button), right-aligned. */
  action?: React.ReactNode;
  className?: string;
};

/**
 * Standard top-of-page block: title, description, optional date-range filter,
 * and a primary action slot. Used by every app page for a consistent header.
 */
export function PageHeader({
  title,
  description,
  dateRange,
  action,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="text-muted-foreground text-sm">{description}</p>
        ) : null}
      </div>
      {dateRange || action ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {dateRange}
          {action}
        </div>
      ) : null}
    </div>
  );
}
