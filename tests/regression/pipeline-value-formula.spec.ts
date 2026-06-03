import { test, expect } from "@playwright/test";
import {
  expectedPipelineCents,
  type PipelineDeal,
} from "../../lib/dashboards/pipeline-value";

/**
 * Phase 13 regression: the dashboard "Pipeline Value" must weight each
 * non-terminal deal by sales price × commission % × stage probability — NOT
 * just price × probability. A single deal makes the difference obvious.
 */
test("pipeline value multiplies by commission, not just probability", () => {
  const deal: PipelineDeal = {
    sales_price_cents: 100_000_00, // $100,000
    commission_pct: 3, // 3%
    probabilityPct: 50, // 50%
    isTerminalWon: false,
    isTerminalLost: false,
  };

  // Correct: 100,000 × 0.03 × 0.50 = $1,500.
  expect(expectedPipelineCents([deal])).toBe(1_500_00);
  // The buggy formula (price × probability, no commission) would be $50,000.
  expect(expectedPipelineCents([deal])).not.toBe(50_000_00);
});

test("pipeline value excludes terminal (won/lost) deals", () => {
  const base: PipelineDeal = {
    sales_price_cents: 100_000_00,
    commission_pct: 3,
    probabilityPct: 100,
    isTerminalWon: false,
    isTerminalLost: false,
  };
  expect(expectedPipelineCents([{ ...base, isTerminalWon: true }])).toBe(0);
  expect(expectedPipelineCents([{ ...base, isTerminalLost: true }])).toBe(0);
});
