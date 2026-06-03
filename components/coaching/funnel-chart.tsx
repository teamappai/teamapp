import { buildFunnel, type FunnelInput } from "@/lib/coaching/aggregate";
import { formatNumber, formatPercent } from "@/lib/utils/format";
import { Card, CardContent } from "@/components/ui/card";

/**
 * The canonical 7-stage coaching funnel (PA-5), rendered as a horizontal funnel
 * with the conversion rate shown between each stage. Bars scale to the largest
 * stage value so the narrowing shape reads at a glance.
 */
// Darkened to ≥700 so the white in-bar value text clears WCAG AA 4.5:1
// (Phase 14 a11y); the hues still read as a distinct narrowing gradient.
const BAR_COLORS = [
  "bg-sky-700",
  "bg-sky-800",
  "bg-indigo-700",
  "bg-indigo-800",
  "bg-violet-700",
  "bg-purple-700",
  "bg-emerald-700",
];

export function FunnelChart({ input }: { input: FunnelInput }) {
  const stages = buildFunnel(input);
  const max = Math.max(1, ...stages.map((s) => s.value));

  return (
    <Card className="gap-0 py-4">
      <CardContent className="space-y-1">
        <h2 className="mb-3 text-sm font-semibold">Conversion funnel</h2>
        {stages.map((stage, i) => (
          <div key={stage.key}>
            {i > 0 ? (
              <div className="flex items-center gap-2 py-0.5 pl-1">
                <span className="text-muted-foreground text-xs">↓</span>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {stage.conversionPct === null
                    ? "—"
                    : `${formatPercent(stage.conversionPct)} conversion`}
                </span>
              </div>
            ) : null}
            <div
              className="flex items-center gap-3"
              title={`${stage.label}: ${formatNumber(stage.value)}`}
            >
              <div className="w-32 shrink-0 text-sm font-medium">
                {stage.label}
              </div>
              <div className="bg-muted/40 h-7 flex-1 overflow-hidden rounded">
                <div
                  className={`flex h-full items-center rounded ${BAR_COLORS[i]} min-w-[2.5rem] px-2`}
                  style={{
                    width: `${Math.max(6, (stage.value / max) * 100)}%`,
                  }}
                >
                  <span className="text-xs font-semibold text-white tabular-nums">
                    {formatNumber(stage.value)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
