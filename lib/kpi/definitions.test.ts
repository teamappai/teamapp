import { describe, expect, it } from "vitest";
import {
  KPI_DEFINITIONS,
  computeKpis,
  type KpiDeal,
  type KpiStage,
} from "./definitions";

/**
 * These tests are the guardrail for audit F-026 / F-027: every KPI's helper
 * text must describe what its compute function actually does. The snapshot
 * pins the label/helper text, and the behavioural assertions pin the
 * computation, so changing one without the other fails review.
 */

const STAGES: Record<string, KpiStage> = {
  submitted: {
    name: "Submitted",
    is_terminal_won: false,
    is_terminal_lost: false,
    probability_pct: 10,
  },
  active: {
    name: "Active",
    is_terminal_won: false,
    is_terminal_lost: false,
    probability_pct: 40,
  },
  underContract: {
    name: "Under Contract",
    is_terminal_won: false,
    is_terminal_lost: false,
    probability_pct: 80,
  },
  closed: {
    name: "Closed",
    is_terminal_won: true,
    is_terminal_lost: false,
    probability_pct: 100,
  },
  lost: {
    name: "Lost/Trash",
    is_terminal_won: false,
    is_terminal_lost: true,
    probability_pct: 0,
  },
};

function deal(partial: Partial<KpiDeal>): KpiDeal {
  return {
    gci_cents: null,
    sales_price_cents: null,
    close_date: null,
    stage: null,
    ...partial,
  };
}

const YEAR = 2026;

describe("KPI registry shape", () => {
  it("helper text + labels are pinned alongside the compute (F-026/F-027)", () => {
    expect(
      KPI_DEFINITIONS.map((k) => ({
        key: k.key,
        label: k.label,
        helperText: k.helperText,
        format: k.format,
      })),
    ).toMatchInlineSnapshot(`
      [
        {
          "format": "currency",
          "helperText": "Total commission income from closed deals YTD",
          "key": "ytd_gci",
          "label": "YTD GCI",
        },
        {
          "format": "count",
          "helperText": "Closed deals YTD",
          "key": "ytd_closed_deals",
          "label": "Closed Deals (YTD)",
        },
        {
          "format": "currency",
          "helperText": "Estimated value of deals in progress (price × probability)",
          "key": "pipeline_value",
          "label": "Pipeline Value",
        },
        {
          "format": "count",
          "helperText": "Deals currently in 'Active' or 'Listed' stages",
          "key": "active_listings",
          "label": "Active Listings",
        },
      ]
    `);
  });

  it("never labels a card 'average' while summing (F-026)", () => {
    const gci = KPI_DEFINITIONS.find((k) => k.key === "ytd_gci")!;
    expect(gci.helperText.toLowerCase()).not.toContain("average");
  });
});

function compute(key: string, deals: KpiDeal[]): number {
  return KPI_DEFINITIONS.find((k) => k.key === key)!.compute(deals, {
    year: YEAR,
  });
}

describe("ytd_gci — sum of GCI from deals closed this year", () => {
  it("sums only terminal-won deals closed in the target year", () => {
    const deals = [
      deal({
        stage: STAGES.closed,
        gci_cents: 4020000,
        close_date: "2026-03-01",
      }),
      deal({
        stage: STAGES.closed,
        gci_cents: 1000000,
        close_date: "2026-11-30",
      }),
      // closed last year — excluded
      deal({
        stage: STAGES.closed,
        gci_cents: 9999999,
        close_date: "2025-12-31",
      }),
      // in progress — excluded (this is the F-026 trap)
      deal({ stage: STAGES.active, gci_cents: 5000000, close_date: null }),
    ];
    expect(compute("ytd_gci", deals)).toBe(4020000 + 1000000);
  });
});

describe("ytd_closed_deals — count, matches the 'closed' title (F-027)", () => {
  it("counts only terminal-won deals closed this year, not active+closed", () => {
    const deals = [
      deal({ stage: STAGES.closed, close_date: "2026-01-15" }),
      deal({ stage: STAGES.closed, close_date: "2026-09-09" }),
      deal({ stage: STAGES.closed, close_date: "2025-06-06" }), // last year
      deal({ stage: STAGES.active, close_date: null }), // active, must NOT count
      deal({ stage: STAGES.underContract, close_date: null }),
    ];
    expect(compute("ytd_closed_deals", deals)).toBe(2);
  });
});

describe("pipeline_value — price × probability over non-terminal stages", () => {
  it("weights by stage probability and excludes terminal stages", () => {
    const deals = [
      deal({ stage: STAGES.active, sales_price_cents: 100_000_00 }), // 40% -> 40_000_00
      deal({ stage: STAGES.underContract, sales_price_cents: 200_000_00 }), // 80% -> 160_000_00
      deal({ stage: STAGES.closed, sales_price_cents: 999_000_00 }), // terminal -> 0
      deal({ stage: STAGES.lost, sales_price_cents: 999_000_00 }), // terminal -> 0
    ];
    expect(compute("pipeline_value", deals)).toBe(40_000_00 + 160_000_00);
  });
});

describe("active_listings — count of Active/Listed non-terminal stages", () => {
  it("counts only Active/Listed stages", () => {
    const deals = [
      deal({ stage: STAGES.active }),
      deal({ stage: STAGES.active }),
      deal({ stage: STAGES.submitted }), // not active/listed
      deal({ stage: STAGES.closed }), // terminal
    ];
    expect(compute("active_listings", deals)).toBe(2);
  });
});

describe("computeKpis formats values via the app formatters", () => {
  it("currency KPIs render with $ and counts as plain numbers", () => {
    const deals = [
      deal({
        stage: STAGES.closed,
        gci_cents: 4020000,
        close_date: "2026-03-01",
      }),
    ];
    const tiles = computeKpis(deals, { year: YEAR });
    const gci = tiles.find((t) => t.key === "ytd_gci")!;
    const closed = tiles.find((t) => t.key === "ytd_closed_deals")!;
    expect(gci.value).toBe("$40,200");
    expect(closed.value).toBe("1");
  });
});
