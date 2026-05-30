import { formatCurrency, formatNumber } from "@/lib/utils/format";

/**
 * Typed KPI registry for the Deals dashboard (audit F-026 / F-027).
 *
 * The whole point of this file is that each KPI's `helperText` and its
 * `compute` function live side by side, so a reviewer can confirm the helper
 * text actually describes the computation. The audit flagged two contradictions
 * here — a card labelled "average" that summed, and a "closed deals" count that
 * actually counted active+closed. The co-located definition plus the snapshot
 * test in `definitions.test.ts` make that class of drift reviewable.
 */

/** Minimal stage shape a KPI needs. Mirrors `deal_stages` columns. */
export type KpiStage = {
  name: string;
  is_terminal_won: boolean;
  is_terminal_lost: boolean;
  probability_pct: number;
};

/** Minimal deal shape the KPI computations read. */
export type KpiDeal = {
  gci_cents: number | null;
  sales_price_cents: number | null;
  /** ISO date (YYYY-MM-DD) the deal closed, or null if not closed. */
  close_date: string | null;
  stage: KpiStage | null;
};

export type KpiFormat = "currency" | "count";

export type KpiContext = {
  /** Calendar year the "YTD" window refers to. Defaults to the current year. */
  year: number;
};

export type KpiDefinition = {
  key: string;
  label: string;
  helperText: string;
  format: KpiFormat;
  /** Returns the raw numeric value (cents for currency, a count otherwise). */
  compute: (deals: KpiDeal[], ctx: KpiContext) => number;
};

function isTerminal(stage: KpiStage | null): boolean {
  return !!stage && (stage.is_terminal_won || stage.is_terminal_lost);
}

/** Year of an ISO date string, or null if absent/unparseable. */
function yearOf(isoDate: string | null): number | null {
  if (!isoDate) return null;
  const year = Number(isoDate.slice(0, 4));
  return Number.isFinite(year) ? year : null;
}

/** Stages that represent an active listing for the Active Listings KPI. */
function isActiveListingStage(stage: KpiStage | null): boolean {
  if (!stage || isTerminal(stage)) return false;
  const name = stage.name.trim().toLowerCase();
  return name === "active" || name === "listed";
}

export const KPI_DEFINITIONS: readonly KpiDefinition[] = [
  {
    key: "ytd_gci",
    label: "YTD GCI",
    helperText: "Total commission income from closed deals YTD",
    format: "currency",
    // Sum of gci_cents for deals in a terminal-won stage that closed this year.
    compute: (deals, { year }) =>
      deals
        .filter(
          (d) => d.stage?.is_terminal_won && yearOf(d.close_date) === year,
        )
        .reduce((sum, d) => sum + (d.gci_cents ?? 0), 0),
  },
  {
    key: "ytd_closed_deals",
    label: "Closed Deals (YTD)",
    helperText: "Closed deals YTD",
    format: "count",
    // Count of deals in a terminal-won stage that closed this year.
    compute: (deals, { year }) =>
      deals.filter(
        (d) => d.stage?.is_terminal_won && yearOf(d.close_date) === year,
      ).length,
  },
  {
    key: "pipeline_value",
    label: "Pipeline Value",
    helperText: "Estimated value of deals in progress (price × probability)",
    format: "currency",
    // Sum of sales_price_cents × probability for deals in non-terminal stages.
    compute: (deals) =>
      Math.round(
        deals
          .filter((d) => !isTerminal(d.stage))
          .reduce(
            (sum, d) =>
              sum +
              (d.sales_price_cents ?? 0) *
                ((d.stage?.probability_pct ?? 0) / 100),
            0,
          ),
      ),
  },
  {
    key: "active_listings",
    label: "Active Listings",
    helperText: "Deals currently in 'Active' or 'Listed' stages",
    format: "count",
    // Count of deals in a non-terminal "Active"/"Listed" stage.
    compute: (deals) =>
      deals.filter((d) => isActiveListingStage(d.stage)).length,
  },
] as const;

/** Format a computed KPI value for display using the app formatters. */
export function formatKpiValue(kpi: KpiDefinition, value: number): string {
  return kpi.format === "currency"
    ? formatCurrency(value)
    : formatNumber(value);
}

/** Compute every KPI against a deal set; returns display-ready tiles. */
export function computeKpis(
  deals: KpiDeal[],
  ctx: KpiContext,
): Array<{
  key: string;
  label: string;
  helperText: string;
  value: string;
  raw: number;
}> {
  return KPI_DEFINITIONS.map((kpi) => {
    const raw = kpi.compute(deals, ctx);
    return {
      key: kpi.key,
      label: kpi.label,
      helperText: kpi.helperText,
      value: formatKpiValue(kpi, raw),
      raw,
    };
  });
}
