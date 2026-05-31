import { formatDistanceToNow } from "date-fns";

/**
 * App-wide formatting helpers (audit CR-6). Every date, money, percent, and
 * number display in the product MUST route through these so formatting stays
 * consistent. The allowed date formats are a closed set on purpose — feature
 * code should not reach for ad-hoc `toLocaleDateString` calls.
 */

export type DateFormat = "short" | "long" | "iso" | "relative";

const SHORT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const LONG = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

/** Coerce input to a Date; returns an invalid Date for unparseable input. */
function toDate(value: Date | string): Date {
  if (value instanceof Date) return value;
  // A date-only string (YYYY-MM-DD) has no timezone and denotes a calendar
  // day — parse it as LOCAL midnight so it never shifts a day in negative-UTC
  // timezones (e.g. a close_date of "2026-06-15" must not render as Jun 14).
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    const [, y, m, d] = dateOnly;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  return new Date(value);
}

/**
 * Format a date in one of four allowed styles:
 *   short:    "May 10, 2026"
 *   long:     "Monday, May 10, 2026"
 *   iso:      "2026-05-10"
 *   relative: "2 hours ago"
 */
export function formatDate(
  value: Date | string,
  format: DateFormat = "short",
): string {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return "";

  switch (format) {
    case "short":
      return SHORT.format(date);
    case "long":
      return LONG.format(date);
    case "iso": {
      const y = date.getFullYear().toString().padStart(4, "0");
      const m = (date.getMonth() + 1).toString().padStart(2, "0");
      const d = date.getDate().toString().padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    case "relative":
      return formatDistanceToNow(date, { addSuffix: true });
  }
}

/**
 * Format integer cents as USD. Symbol is always on the LEFT (audit F-101) and
 * $0 renders as "$0", never "$0.0" (audit F-021). `compact` collapses large
 * amounts to "$1.2M" / "$250K" (a trailing ".0" is trimmed → "$1M").
 *
 * `precise` (only meaningful with `compact`) KEEPS one decimal even when it's
 * zero → "$1.0M" / "$250.0K". Coaching contexts use this for the trailing-zero
 * precision Phil prefers; the rest of the app stays on the trimmed default.
 */
export function formatCurrency(
  cents: number,
  options?: { compact?: boolean; precise?: boolean },
): string {
  const dollars = (cents ?? 0) / 100;

  if (options?.compact) {
    const abs = Math.abs(dollars);
    const sign = dollars < 0 ? "-" : "";
    const scale = options.precise ? (n: number) => n.toFixed(1) : trimZero;
    if (abs >= 1_000_000) return `${sign}$${scale(abs / 1_000_000)}M`;
    if (abs >= 1_000) return `${sign}$${scale(abs / 1_000)}K`;
    return `${sign}$${formatNumber(Math.round(abs))}`;
  }

  const sign = dollars < 0 ? "-" : "";
  return `${sign}$${formatNumber(Math.round(Math.abs(dollars)))}`;
}

/** One decimal place, but drop a trailing ".0" (so 250 -> "250", 1.2 -> "1.2"). */
function trimZero(value: number): string {
  return value.toFixed(1).replace(/\.0$/, "");
}

/**
 * Format a ratio as a percent. Defaults to an integer (audit F-118) — never a
 * raw float. `value` is the already-computed percentage (e.g. 42, not 0.42).
 */
export function formatPercent(value: number, fractionDigits = 0): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe.toFixed(fractionDigits)}%`;
}

/** Format an integer or float with thousands separators. */
export function formatNumber(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("en-US").format(safe);
}

/** Human-readable file size: 1024 -> "1 KB", 1536000 -> "1.5 MB". */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exp = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** exp;
  return `${exp === 0 ? value : trimZero(value)} ${units[exp]}`;
}
