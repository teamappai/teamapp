/**
 * Tests for the canonical pricing source of truth (lib/billing/plans.ts).
 * Pure (no network / env). Run:  pnpm exec tsx scripts/test-plans.ts
 */
import {
  PLANS,
  PLAN_ORDER,
  calculatePrice,
  formatPrice,
  annualDiscountPct,
} from "../lib/billing/plans";

let failures = 0;

function assert(label: string, cond: boolean, detail?: string) {
  if (!cond) failures++;
  console.log(`  ${cond ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
}

function eq(label: string, actual: unknown, expected: unknown) {
  assert(label, actual === expected, `got ${actual}, expected ${expected}`);
}

console.log("Pricing source-of-truth tests\n");

// Each plan's annual price is ~20% off 12 × monthly, within $0.10 (10 cents).
console.log("annual ≈ 20% off 12 × monthly (±$0.10):");
for (const id of PLAN_ORDER) {
  const p = PLANS[id];
  const expectedAnnual = Math.round(p.monthly_price_cents * 12 * 0.8);
  const diff = Math.abs(p.annual_price_cents - expectedAnnual);
  assert(
    `${id}: annual within tolerance`,
    diff <= 10,
    `annual=${p.annual_price_cents}, expected≈${expectedAnnual}, diff=${diff}c, discount=${annualDiscountPct(p)}%`,
  );
}

console.log("calculatePrice:");
eq("launch monthly 10 seats", calculatePrice("launch", "monthly", 10), 25000);
eq("launch monthly 15 seats", calculatePrice("launch", "monthly", 15), 37500);
eq("pro annual 25 seats", calculatePrice("pro", "annual", 25), 571200);
eq("pro annual 30 seats", calculatePrice("pro", "annual", 30), 643200);
eq(
  "brokerage monthly 100 seats",
  calculatePrice("brokerage", "monthly", 100),
  150000,
);

console.log("formatPrice:");
eq('formatPrice(25000) === "$250"', formatPrice(25000), "$250");

console.log(
  `\n${failures === 0 ? "ALL PLAN TESTS PASSED ✓" : `${failures} TEST(S) FAILED ✗`}`,
);
process.exit(failures === 0 ? 0 : 1);
