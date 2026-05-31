import { describe, expect, it } from "vitest";
import {
  buildFunnel,
  heatBucket,
  leaderboardCurrency,
  leaderboardCount,
  sortLeaderboard,
  type LeaderboardRow,
} from "./aggregate";
import { goalWindow, computeGoalActual } from "./goals";

describe("buildFunnel", () => {
  it("produces 7 stages with conversion from the previous stage", () => {
    const stages = buildFunnel({
      topOfFunnel: 100,
      appointments: 25,
      pipeline: 10,
      showings: 8,
      offers: 4,
      underContract: 2,
      closed: 1,
    });
    expect(stages).toHaveLength(7);
    expect(stages[0].conversionPct).toBeNull();
    expect(stages[1].conversionPct).toBe(25); // 25/100
    expect(stages[2].conversionPct).toBe(40); // 10/25
    expect(stages[6].label).toBe("Closed");
  });

  it("guards against divide-by-zero on an empty top", () => {
    const stages = buildFunnel({
      topOfFunnel: 0,
      appointments: 0,
      pipeline: 0,
      showings: 0,
      offers: 0,
      underContract: 0,
      closed: 0,
    });
    expect(stages[1].conversionPct).toBeNull();
  });
});

describe("leaderboard formatting (F-021)", () => {
  it("renders zero currency as an em dash, not $0", () => {
    expect(leaderboardCurrency(0)).toBe("—");
    // Precise compact form (coaching keeps the trailing .0).
    expect(leaderboardCurrency(1_200_000_00)).toBe("$1.2M");
    expect(leaderboardCurrency(1_000_000_00)).toBe("$1.0M");
    expect(leaderboardCurrency(250_000_00)).toBe("$250.0K");
  });
  it("renders zero counts as an em dash", () => {
    expect(leaderboardCount(0)).toBe("—");
    expect(leaderboardCount(12)).toBe("12");
  });
});

describe("sortLeaderboard", () => {
  const rows: LeaderboardRow[] = [
    mk("a", "Ann", 100),
    mk("b", "Bob", 300),
    mk("c", "Cat", 200),
  ];
  function mk(userId: string, name: string, gci: number): LeaderboardRow {
    return {
      userId,
      name,
      avatarUrl: null,
      goalLabel: null,
      gciCents: gci,
      closedVolumeCents: 0,
      closedDeals: 0,
      appointments: 0,
      conversations: 0,
      lastActivityAt: null,
    };
  }
  it("default GCI desc puts the top earner first (F-020)", () => {
    const sorted = sortLeaderboard(rows, "gciCents", "desc");
    expect(sorted.map((r) => r.name)).toEqual(["Bob", "Cat", "Ann"]);
  });
});

describe("heatBucket", () => {
  it("ranks intensity", () => {
    expect(heatBucket(0)).toBe(0);
    expect(heatBucket(5)).toBe(1);
    expect(heatBucket(60)).toBe(4);
  });
});

describe("goalWindow + computeGoalActual", () => {
  it("computes an inclusive monthly window", () => {
    expect(goalWindow("monthly", "2026-05-01")).toEqual({
      start: "2026-05-01",
      end: "2026-05-31",
    });
  });

  it("sums the right activity column within the window", () => {
    const actual = computeGoalActual(
      "conversations_count",
      { start: "2026-05-01", end: "2026-05-31" },
      {
        activity: [
          { log_date: "2026-05-10", conversations: 5 },
          { log_date: "2026-05-20", conversations: 7 },
          { log_date: "2026-04-30", conversations: 99 }, // out of window
        ],
        deals: [],
      },
    );
    expect(actual).toBe(12);
  });

  it("sums closed-deal GCI for an outcome goal", () => {
    const actual = computeGoalActual(
      "gci_cents",
      { start: "2026-01-01", end: "2026-12-31" },
      {
        activity: [],
        deals: [
          {
            gci_cents: 4020000,
            sales_price_cents: 0,
            close_date: "2026-03-01",
            isTerminalWon: true,
          },
          {
            gci_cents: 100,
            sales_price_cents: 0,
            close_date: "2026-03-01",
            isTerminalWon: false,
          },
        ],
      },
    );
    expect(actual).toBe(4020000);
  });
});
