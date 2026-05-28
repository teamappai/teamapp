import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils/index";

export type SortDir = "asc" | "desc";

/** Serializable query params; values are merged over the current ones. */
type Params = Record<string, string | undefined>;

function buildHref(basePath: string, params: Params): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") sp.set(k, v);
  }
  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/**
 * A clickable column header that toggles sort direction via URL query params,
 * so sorting is server-rendered and shareable. Clicking the active column flips
 * asc/desc; clicking another column sorts it descending first.
 */
export function SortableHeader({
  column,
  label,
  basePath,
  current,
  className,
}: {
  column: string;
  label: string;
  basePath: string;
  /** Current query params (preserved across sort changes). */
  current: Params & { sort?: string; dir?: string };
  className?: string;
}) {
  const isActive = current.sort === column;
  const nextDir: SortDir = isActive && current.dir === "desc" ? "asc" : "desc";
  const href = buildHref(basePath, {
    ...current,
    sort: column,
    dir: nextDir,
  });

  return (
    <Link
      href={href}
      className={cn(
        "text-muted-foreground hover:text-foreground inline-flex items-center gap-1 font-medium",
        isActive && "text-foreground",
        className,
      )}
    >
      {label}
      {isActive ? (
        current.dir === "asc" ? (
          <ArrowUp className="size-3.5" aria-hidden />
        ) : (
          <ArrowDown className="size-3.5" aria-hidden />
        )
      ) : (
        <ChevronsUpDown className="size-3.5 opacity-50" aria-hidden />
      )}
    </Link>
  );
}

/**
 * A filter chip that links to the same page with one param set (or cleared when
 * already active). Use for Plan / Status / Role filters.
 */
export function FilterChip({
  label,
  paramKey,
  value,
  basePath,
  current,
}: {
  label: string;
  paramKey: string;
  /** undefined = the "All" chip (clears the filter). */
  value?: string;
  basePath: string;
  current: Params;
}) {
  const isActive = (current[paramKey] ?? undefined) === value;
  // Toggling an active specific chip clears it; "All" always clears.
  const nextValue = isActive ? undefined : value;
  const href = buildHref(basePath, {
    ...current,
    [paramKey]: nextValue,
    // Reset to first page semantics not needed (no pagination yet).
  });

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        isActive
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:bg-muted",
      )}
    >
      {label}
    </Link>
  );
}
