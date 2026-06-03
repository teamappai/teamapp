import { formatDate } from "@/lib/utils/format";
import { addDaysIso, todayIso } from "@/lib/coaching/dates";

/**
 * Date-range handling for the Phase 13 dashboards and drill-down tabs.
 *
 * Mirrors lib/coaching/dates but adds an "All time" preset and defaults to the
 * last 30 days (Decision 9), keeping the coaching module's own default (90)
 * untouched. All boundaries are inclusive YYYY-MM-DD calendar days.
 */

export type DashRangeKey = "7" | "30" | "90" | "ytd" | "all" | "custom";

export type DashRange = {
  key: DashRangeKey;
  /** Inclusive lower bound (YYYY-MM-DD). */
  from: string;
  /** Inclusive upper bound (YYYY-MM-DD). */
  to: string;
  label: string;
};

export const DASH_RANGE_PRESETS: ReadonlyArray<{
  key: DashRangeKey;
  label: string;
}> = [
  { key: "7", label: "Last 7" },
  { key: "30", label: "Last 30" },
  { key: "90", label: "Last 90" },
  { key: "ytd", label: "YTD" },
  { key: "all", label: "All time" },
  { key: "custom", label: "Custom" },
];

/** Far-past sentinel so "All time" includes every row. */
const EPOCH = "1970-01-01";

const isValidIso = (s: string | undefined): s is string =>
  !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

/**
 * Resolve a DashRange from search params. Unknown/invalid input falls back to
 * the default (Last 30). Custom requires two valid, ordered dates.
 */
export function resolveDashRange(params: {
  range?: string;
  from?: string;
  to?: string;
}): DashRange {
  const key = (DASH_RANGE_PRESETS.find((p) => p.key === params.range)?.key ??
    "30") as DashRangeKey;
  const to = todayIso();

  if (key === "custom") {
    const from = isValidIso(params.from) ? params.from : addDaysIso(to, -29);
    const customTo = isValidIso(params.to) ? params.to : to;
    const [lo, hi] = from <= customTo ? [from, customTo] : [customTo, from];
    return {
      key,
      from: lo,
      to: hi,
      label: `${formatDate(lo)} – ${formatDate(hi)}`,
    };
  }

  if (key === "all") {
    return { key, from: EPOCH, to, label: "All time" };
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

/** First day of the current calendar year, YYYY-MM-DD. */
export function yearStartIso(): string {
  return `${todayIso().slice(0, 4)}-01-01`;
}
