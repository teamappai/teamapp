/**
 * Pure aggregation helpers for the coaching dashboard. No I/O — these take
 * already-fetched, plain data so they can be unit tested and reused by both the
 * team and agent variants.
 */

import { formatCurrency, formatNumber } from "@/lib/utils/format";

// ── Funnel ─────────────────────────────────────────────────────────────────────

export type FunnelInput = {
  topOfFunnel: number;
  appointments: number;
  pipeline: number;
  showings: number;
  offers: number;
  underContract: number;
  closed: number;
};

export type FunnelStage = {
  key: string;
  label: string;
  value: number;
  /** Conversion from the previous stage (null for the first stage). */
  conversionPct: number | null;
};

/**
 * The one canonical 7-stage funnel (PA-5): Top of Funnel → Appointments →
 * Pipeline → Showings → Offers → Under Contract → Closed, with the conversion
 * rate from each stage to the next shown between them.
 */
export function buildFunnel(input: FunnelInput): FunnelStage[] {
  const stages: Array<{ key: string; label: string; value: number }> = [
    { key: "top_of_funnel", label: "Top of Funnel", value: input.topOfFunnel },
    { key: "appointments", label: "Appointments", value: input.appointments },
    { key: "pipeline", label: "Pipeline", value: input.pipeline },
    { key: "showings", label: "Showings", value: input.showings },
    { key: "offers", label: "Offers", value: input.offers },
    {
      key: "under_contract",
      label: "Under Contract",
      value: input.underContract,
    },
    { key: "closed", label: "Closed", value: input.closed },
  ];
  return stages.map((s, i) => {
    const prev = i === 0 ? null : stages[i - 1].value;
    const conversionPct =
      prev && prev > 0 ? Math.round((s.value / prev) * 100) : null;
    return { ...s, conversionPct };
  });
}

// ── Leaderboard ─────────────────────────────────────────────────────────────--

export type LeaderboardRow = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  /** Primary outcome goal summary, e.g. "GCI $200K" — or null if none set. */
  goalLabel: string | null;
  gciCents: number;
  closedVolumeCents: number;
  closedDeals: number;
  appointments: number;
  conversations: number;
  /** ISO timestamp of the agent's most recent activity, or null. */
  lastActivityAt: string | null;
};

export type LeaderboardSortKey =
  | "name"
  | "gciCents"
  | "closedVolumeCents"
  | "closedDeals"
  | "appointments"
  | "conversations"
  | "lastActivityAt";

export type SortDir = "asc" | "desc";

/** Sort leaderboard rows; default usage is GCI desc (audit F-020). */
export function sortLeaderboard(
  rows: LeaderboardRow[],
  key: LeaderboardSortKey,
  dir: SortDir,
): LeaderboardRow[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (key === "name") return sign * a.name.localeCompare(b.name);
    if (key === "lastActivityAt") {
      const av = a.lastActivityAt ?? "";
      const bv = b.lastActivityAt ?? "";
      return sign * av.localeCompare(bv);
    }
    return sign * ((a[key] as number) - (b[key] as number));
  });
}

/**
 * Currency for the leaderboard: compact + precise ("$1.0M", "$250.0K"), and
 * zero shown as an em dash rather than "$0" so empty rows read cleanly
 * (audit F-021). The trailing zero is intentional for coaching contexts.
 */
export function leaderboardCurrency(cents: number): string {
  if (!cents) return "—";
  return formatCurrency(cents, { compact: true, precise: true });
}

/** Count cell: zero shown as an em dash for visual calm (audit F-021). */
export function leaderboardCount(n: number): string {
  return n ? formatNumber(n) : "—";
}

// ── Heatmap ────────────────────────────────────────────────────────────────--

export type HeatCell = {
  date: string;
  total: number;
  isOffDay: boolean;
  /** No log row at all for this agent/day. */
  empty: boolean;
};

export type HeatRow = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  cells: HeatCell[];
};

/**
 * Color bucket (0–4) for a heatmap cell by activity volume. Off-day and empty
 * are handled by the renderer; this only ranks worked-day intensity.
 */
export function heatBucket(total: number): 0 | 1 | 2 | 3 | 4 {
  if (total <= 0) return 0;
  if (total < 10) return 1;
  if (total < 25) return 2;
  if (total < 50) return 3;
  return 4;
}
