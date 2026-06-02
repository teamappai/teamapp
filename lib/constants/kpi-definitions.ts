/**
 * Central registry of KPI helper text (Phase 13 / audit F-026, F-027).
 *
 * Every dashboard KPI card MUST pull its title + helper from here so the helper
 * line can never contradict what the number actually represents. NEVER hardcode
 * helper text inline in a card.
 */

export type KpiFormat = "currency" | "count" | "percent";

export type KpiDefinition = {
  /** Card title (also used as the aria label). */
  title: string;
  /** One-line helper rendered under the value. */
  helper: string;
  /** Precise definition surfaced in the info tooltip. */
  definition: string;
  format: KpiFormat;
  /** Optional emphasis note for the tooltip (e.g. expected vs gross). */
  importantNote?: string;
};

export const KPI_DEFINITIONS = {
  ytd_gci: {
    title: "YTD GCI",
    helper: "Gross Commission Income from closed deals, year-to-date",
    definition:
      'Sum of GCI on deals in a terminal-won ("Closed") stage whose close date is in the current calendar year.',
    format: "currency",
  },
  ytd_volume: {
    title: "YTD Volume",
    helper: "Total sales volume from closed deals, year-to-date",
    definition:
      'Sum of sales price for deals in a terminal-won ("Closed") stage whose close date is in the current calendar year.',
    format: "currency",
  },
  pipeline_value: {
    title: "Pipeline Value",
    helper:
      "Projected GCI from active deals (price × commission × probability)",
    definition:
      "Sum of (sales price × commission % × stage win-probability) across deals NOT in a terminal stage (Closed, Cancelled, Expired, Trash).",
    format: "currency",
    importantNote:
      "Pipeline Value is expected commission, NOT gross transaction value.",
  },
  goal_progress: {
    title: "Goal Progress",
    helper: "Team progress toward the active goal for this period",
    definition:
      "Current actual vs target for the company-wide goal whose period covers today.",
    format: "percent",
  },
  // Agent KPIs
  agent_goal_progress: {
    title: "Goal Progress",
    helper: "Your progress toward your active goal for this period",
    definition:
      "Your current actual vs target for the goal whose period covers today.",
    format: "percent",
  },
  agent_ytd_volume: {
    title: "YTD Volume",
    helper: "Your sales volume from closed deals, year-to-date",
    definition:
      "Sum of sales price for your closed deals with a close date this calendar year.",
    format: "currency",
  },
  agent_ytd_gci: {
    title: "YTD GCI",
    helper: "Your commission income from closed deals, year-to-date",
    definition:
      "Sum of GCI on your closed deals with a close date this calendar year.",
    format: "currency",
  },
  agent_closed_deals: {
    title: "Closed Deals",
    helper: "Deals you have closed, year-to-date",
    definition:
      "Count of your deals in a terminal-won stage with a close date this calendar year.",
    format: "count",
  },
  onboarding: {
    title: "Onboarding",
    helper: "Training modules completed out of those assigned to you",
    definition:
      "Completed modules ÷ total published modules visible to your role. Single source of truth (F-108/F-119).",
    format: "percent",
  },
} as const satisfies Record<string, KpiDefinition>;

export type KpiKey = keyof typeof KPI_DEFINITIONS;

export function kpi(key: KpiKey): KpiDefinition {
  return KPI_DEFINITIONS[key];
}
