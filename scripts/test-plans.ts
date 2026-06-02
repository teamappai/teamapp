/**
 * Tests for the canonical pricing source of truth (lib/billing/plans.ts).
 * Pure (no network / env). Run:  pnpm exec tsx scripts/test-plans.ts
 */
import {
  PLANS,
  SELF_SERVE_PLANS,
  calculatePrice,
  extraSeatsMonthlyCents,
  formatPrice,
  annualMonthlyEquivalentCents,
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

// Annual = 10 × monthly for self-serve plans ("2 months free").
console.log('annual = 10 × monthly ("2 months free"):');
for (const id of SELF_SERVE_PLANS) {
  const p = PLANS[id];
  eq(
    `${id}: annual = 10 × monthly`,
    p.annual_price_cents,
    p.monthly_price_cents * 10,
  );
}

console.log("calculatePrice:");
eq("launch monthly 5 seats", calculatePrice("launch", "monthly", 5), 24500);
eq("launch monthly 10 seats", calculatePrice("launch", "monthly", 10), 37000);
eq("launch annual 5 seats", calculatePrice("launch", "annual", 5), 245000);
eq("pro monthly 25 seats", calculatePrice("pro", "monthly", 25), 59500);
eq("pro monthly 30 seats", calculatePrice("pro", "monthly", 30), 69500);
eq("pro annual 25 seats", calculatePrice("pro", "annual", 25), 595000);

console.log("extra seats ALWAYS billed monthly (even on annual base):");
// annual base + monthly seat overage (mixed cadence): 245000 + 5×2500
eq("launch annual 10 seats", calculatePrice("launch", "annual", 10), 257500);
eq("pro annual 30 seats", calculatePrice("pro", "annual", 30), 605000);
eq(
  "launch extra-seats monthly (10)",
  extraSeatsMonthlyCents("launch", 10),
  12500,
);
eq("pro extra-seats monthly (30)", extraSeatsMonthlyCents("pro", 30), 10000);

console.log("annual per-month equivalent (whole dollar):");
eq(
  "launch annual ≈ $204/mo",
  annualMonthlyEquivalentCents(PLANS.launch),
  20400,
);
eq("pro annual ≈ $496/mo", annualMonthlyEquivalentCents(PLANS.pro), 49600);

console.log("enterprise is custom (no self-serve price):");
assert("enterprise.custom is true", PLANS.enterprise.custom === true);
eq("enterprise monthly price is 0", PLANS.enterprise.monthly_price_cents, 0);

console.log("formatPrice:");
eq('formatPrice(24500) === "$245"', formatPrice(24500), "$245");
eq('formatPrice(2500) === "$25"', formatPrice(2500), "$25");

console.log(
  `\n${failures === 0 ? "ALL PLAN TESTS PASSED ✓" : `${failures} TEST(S) FAILED ✗`}`,
);
process.exit(failures === 0 ? 0 : 1);
