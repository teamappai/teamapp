/**
 * Pipeline value = expected commission across non-terminal deals (audit F-027).
 *
 * Pure + dependency-free so it can be unit/regression-tested without the
 * server-only dashboard module. The formula is intentionally
 * `sales price × commission % × stage probability %` — dropping the commission
 * factor (Phase 13 regression) would massively overstate the pipeline.
 */
export type PipelineDeal = {
  sales_price_cents: number | null;
  commission_pct: number | null;
  /** Stage win-probability, 0–100. */
  probabilityPct: number;
  isTerminalWon: boolean;
  isTerminalLost: boolean;
};

export function expectedPipelineCents(deals: PipelineDeal[]): number {
  return Math.round(
    deals
      .filter((d) => !d.isTerminalWon && !d.isTerminalLost)
      .reduce((sum, d) => {
        const price = d.sales_price_cents ?? 0;
        const commission = (d.commission_pct ?? 0) / 100;
        const probability = d.probabilityPct / 100;
        return sum + price * commission * probability;
      }, 0),
  );
}
