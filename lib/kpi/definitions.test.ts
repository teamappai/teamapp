import { describe, expect, it } from "vitest";
import {
  KPI_DEFINITIONS,
  COACHING_KPI_DEFINITIONS,
  computeKpis,
  type CoachingKpiInput,
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
    name: "Trash",
    is_terminal_won: false,
    is_terminal_lost: true,
    probability_pct: 0,
  },
};

function deal(partial: Partial<KpiDeal>): KpiDeal {
  return {
    gci_cents: null,
    sales_price_cents: null,
    commission_pct: null,
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
          "helperText": "Projected GCI from deals in progress (price × commission × probability)",
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

describe("pipeline_value — price × commission × probability (projected GCI)", () => {
  it("weights by commission and stage probability, excluding terminal stages", () => {
    const deals = [
      // $100k × 3% commission × 40% prob = 100_000_00 × 0.03 × 0.40 = 120_000
      deal({
        stage: STAGES.active,
        sales_price_cents: 100_000_00,
        commission_pct: 3.0,
      }),
      // $200k × 3% × 80% = 200_000_00 × 0.03 × 0.80 = 480_000
      deal({
        stage: STAGES.underContract,
        sales_price_cents: 200_000_00,
        commission_pct: 3.0,
      }),
      // terminal stages contribute 0 regardless of commission
      deal({
        stage: STAGES.closed,
        sales_price_cents: 999_000_00,
        commission_pct: 3.0,
      }),
      deal({
        stage: STAGES.lost,
        sales_price_cents: 999_000_00,
        commission_pct: 3.0,
      }),
    ];
    expect(compute("pipeline_value", deals)).toBe(120_000 + 480_000);
  });

  it("contributes 0 when commission_pct is missing (no projected GCI)", () => {
    const deals = [
      deal({
        stage: STAGES.active,
        sales_price_cents: 100_000_00,
        commission_pct: null,
      }),
    ];
    expect(compute("pipeline_value", deals)).toBe(0);
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

describe("coaching KPI registry (Phase 10)", () => {
  it("every coaching KPI has a label, helper text, and compute function", () => {
    expect(COACHING_KPI_DEFINITIONS.length).toBeGreaterThan(0);
    for (const kpi of COACHING_KPI_DEFINITIONS) {
      expect(kpi.key).toBeTruthy();
      expect(kpi.label).toBeTruthy();
      expect(kpi.helperText.length).toBeGreaterThan(0);
      expect(typeof kpi.compute).toBe("function");
    }
  });

  it("each compute reads the matching field from the input", () => {
    const input: CoachingKpiInput = {
      topOfFunnel: 120,
      appointments: 18,
      pipeline: 9,
      showings: 5,
      offers: 3,
      underContract: 2,
      closed: 1,
    };
    const byKey = (key: string) =>
      COACHING_KPI_DEFINITIONS.find((k) => k.key === key)!.compute(input);
    expect(byKey("top_of_funnel")).toBe(120);
    expect(byKey("appointments")).toBe(18);
    expect(byKey("pipeline")).toBe(9);
    expect(byKey("showings")).toBe(5);
    expect(byKey("offers_submitted")).toBe(3);
    expect(byKey("under_contract")).toBe(2);
    expect(byKey("closed")).toBe(1);
  });

  it("keys are unique", () => {
    const keys = COACHING_KPI_DEFINITIONS.map((k) => k.key);
    expect(new Set(keys).size).toBe(keys.length);
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
