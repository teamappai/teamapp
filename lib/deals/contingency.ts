import { formatDate } from "@/lib/utils/format";

/**
 * RPA-anchored contingency math (audit SR-7). Inspection/appraisal/loan windows
 * count from the RPA signed date, NOT from when the deal was created. These
 * helpers compute the calendar date a contingency clears so the UI can show it
 * live next to the day-count input.
 */

/** Parse a YYYY-MM-DD string as a LOCAL date (avoids UTC off-by-one). */
export function parseISODateLocal(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const [, y, mo, d] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Add `days` to an ISO date, returning a Date (or null on bad input). */
export function addDaysToISODate(iso: string, days: number): Date | null {
  const base = parseISODateLocal(iso);
  if (!base || !Number.isFinite(days)) return null;
  base.setDate(base.getDate() + days);
  return base;
}

/**
 * "Inspection clears on Apr 23, 2026" style string, or null when either input
 * is missing. Uses the app's short date format.
 */
export function contingencyClearsLabel(
  rpaSignedDate: string | null | undefined,
  days: number | null | undefined,
): string | null {
  if (!rpaSignedDate || days == null || !Number.isFinite(days)) return null;
  const date = addDaysToISODate(rpaSignedDate, days);
  if (!date) return null;
  return formatDate(date, "short");
}
