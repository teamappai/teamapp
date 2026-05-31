import { formatDate } from "@/lib/utils/format";

/**
 * Date-range handling for the coaching dashboard (audit F-019/F-077). The range
 * is the single control that scopes every panel — funnel, heatmap, leaderboard,
 * goals — so it lives here and is resolved once from the URL search params.
 *
 * All boundaries are inclusive `YYYY-MM-DD` calendar days, matching
 * activity_logs.log_date. "Today" is the server's local calendar day.
 */

export type RangeKey = "7" | "30" | "90" | "ytd" | "custom";

export type DateRange = {
  key: RangeKey;
  /** Inclusive lower bound (YYYY-MM-DD). */
  from: string;
  /** Inclusive upper bound (YYYY-MM-DD), always today for the presets. */
  to: string;
  /** Chip label for the selected state. */
  label: string;
};

export const RANGE_PRESETS: ReadonlyArray<{ key: RangeKey; label: string }> = [
  { key: "7", label: "Last 7" },
  { key: "30", label: "Last 30" },
  { key: "90", label: "Last 90" },
  { key: "ytd", label: "YTD" },
  { key: "custom", label: "Custom" },
];

/** Today's local calendar day as YYYY-MM-DD. */
export function todayIso(): string {
  return formatDate(new Date(), "iso");
}

/**
 * Day-group header for a timestamp (audit F-110): "Today" / "Yesterday" / an
 * explicit short date. Compares calendar days in local time.
 */
export function dayGroupLabel(value: string | Date): string {
  const day = formatDate(value, "iso");
  const today = todayIso();
  if (day === today) return "Today";
  if (day === addDaysIso(today, -1)) return "Yesterday";
  return formatDate(value, "short");
}

/** Add (or subtract) whole days to a YYYY-MM-DD string, staying calendar-safe. */
export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return formatDate(date, "iso");
}

/** Whether `iso` falls within [range.from, range.to], inclusive. */
export function inRange(
  iso: string | null | undefined,
  range: DateRange,
): boolean {
  if (!iso) return false;
  const day = iso.slice(0, 10);
  return day >= range.from && day <= range.to;
}

/** Number of inclusive calendar days the range spans (>= 1). */
export function rangeDays(range: DateRange): number {
  const a = new Date(`${range.from}T00:00:00`);
  const b = new Date(`${range.to}T00:00:00`);
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1);
}

/**
 * Resolve a DateRange from the dashboard's search params. Unknown/invalid input
 * falls back to the default (Last 90). Custom requires two valid, ordered dates.
 */
export function resolveRange(params: {
  range?: string;
  from?: string;
  to?: string;
}): DateRange {
  const key = (RANGE_PRESETS.find((p) => p.key === params.range)?.key ??
    "90") as RangeKey;
  const to = todayIso();

  const isValidIso = (s: string | undefined): s is string =>
    !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

  if (key === "custom") {
    const from = isValidIso(params.from) ? params.from : addDaysIso(to, -89);
    const customTo = isValidIso(params.to) ? params.to : to;
    // Guard against reversed bounds.
    const [lo, hi] = from <= customTo ? [from, customTo] : [customTo, from];
    return {
      key,
      from: lo,
      to: hi,
      label: `${formatDate(lo)} – ${formatDate(hi)}`,
    };
  }

  if (key === "ytd") {
    const from = `${to.slice(0, 4)}-01-01`;
    return { key, from, to, label: "Year to date" };
  }

  const days = Number(key); // 7 | 30 | 90
  return {
    key,
    from: addDaysIso(to, -(days - 1)),
    to,
    label: `Last ${days} days`,
  };
}
