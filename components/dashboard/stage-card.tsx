import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils/index";
import { formatCurrency } from "@/lib/utils/format";
import { InfoTooltip } from "@/components/dashboard/info-tooltip";
import type { StageCard } from "@/lib/dashboards/shared";

/**
 * Real-estate stage tile. Colors follow F-016/F-033: in-progress is neutral or
 * info-blue (NEVER pink/red); success-green is reserved for closed/won; danger
 * only for losses (Cancelled/Expired).
 */
const TONE: Record<StageCard["tone"], string> = {
  neutral: "text-foreground",
  info: "text-sky-600",
  success: "text-emerald-600",
  danger: "text-red-600",
};

export function StageCardTile({ card }: { card: StageCard }) {
  return (
    <Card className="gap-0 py-4">
      <CardContent className="space-y-1">
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
          <span className="truncate">{card.label}</span>
          <InfoTooltip label={card.tooltip} />
        </div>
        <p
          className={cn(
            "text-2xl font-semibold tracking-tight",
            TONE[card.tone],
          )}
        >
          {card.count}
        </p>
        {card.sumCents !== null ? (
          <p className="text-muted-foreground text-xs">
            {formatCurrency(card.sumCents, { compact: true })}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
