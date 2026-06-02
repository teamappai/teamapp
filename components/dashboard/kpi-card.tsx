import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils/index";
import { kpi, type KpiKey } from "@/lib/constants/kpi-definitions";
import { InfoTooltip } from "@/components/dashboard/info-tooltip";
import { Sparkline } from "@/components/dashboard/sparkline";

type KpiCardProps = {
  kpiKey: KpiKey;
  /** Pre-formatted display value. */
  value: string;
  /** 12-point trend for the sparkline. */
  sparkline?: number[];
  /** Year-over-year delta percent (positive = green, negative = red). */
  yoyPct?: number | null;
  /** Progress bar percent (for goal-style cards). */
  progressPct?: number | null;
  className?: string;
};

/**
 * Dashboard KPI tile. Title + helper come from the central KPI registry so the
 * helper line can never contradict the number (F-026/F-027). The info tooltip
 * surfaces the precise definition + any important note.
 */
export function KpiCard({
  kpiKey,
  value,
  sparkline,
  yoyPct,
  progressPct,
  className,
}: KpiCardProps) {
  const def = kpi(kpiKey);
  const hasYoy = yoyPct !== undefined && yoyPct !== null;

  return (
    <Card className={cn("gap-0 py-4", className)}>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-1.5">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {def.title}
          </p>
          <InfoTooltip label={def.definition} note={def.importantNote} />
        </div>

        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-semibold tracking-tight">{value}</p>
          {hasYoy ? (
            <span
              className={cn(
                "text-xs font-medium",
                yoyPct >= 0 ? "text-emerald-600" : "text-red-600",
              )}
            >
              {yoyPct >= 0 ? "▲" : "▼"} {Math.abs(yoyPct)}% YoY
            </span>
          ) : null}
        </div>

        {progressPct !== undefined && progressPct !== null ? (
          <Progress
            value={progressPct}
            className="h-1.5"
            indicatorClassName="bg-sky-500"
          />
        ) : null}

        {sparkline && sparkline.length > 0 ? (
          <Sparkline data={sparkline} />
        ) : null}

        <p className="text-muted-foreground text-xs">{def.helper}</p>
      </CardContent>
    </Card>
  );
}
