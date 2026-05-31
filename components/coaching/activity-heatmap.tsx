import { heatBucket, type HeatRow } from "@/lib/coaching/aggregate";
import { formatDate } from "@/lib/utils/format";
import { Card, CardContent } from "@/components/ui/card";
import { UserAvatar } from "@/components/shared/user-avatar";
import { cn } from "@/lib/utils/index";

/**
 * Activity heatmap (PA-5): one row per agent, one cell per day. Worked days
 * shade green by intensity; off-days are a distinct medium gray; days with no
 * log at all stay light. Hover (title) gives agent, date, and total.
 */
const BUCKET_CLASS = [
  "bg-muted", // 0 — worked but nothing logged
  "bg-emerald-200",
  "bg-emerald-400",
  "bg-emerald-600",
  "bg-emerald-800",
] as const;

export function ActivityHeatmap({
  dates,
  rows,
}: {
  dates: string[];
  rows: HeatRow[];
}) {
  return (
    <Card className="gap-0 py-4">
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Activity heatmap</h2>
            {dates.length > 0 ? (
              <p className="text-muted-foreground text-xs">
                {formatDate(dates[0])} – {formatDate(dates[dates.length - 1])}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">Less</span>
            {BUCKET_CLASS.map((c, i) => (
              <span key={i} className={cn("size-3 rounded-[3px]", c)} />
            ))}
            <span className="text-muted-foreground">More</span>
            <span className="ml-2 size-3 rounded-[3px] bg-slate-400" />
            <span className="text-muted-foreground">Off-day</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-fit space-y-1">
            {rows.map((row) => (
              <div key={row.userId} className="flex items-center gap-2">
                <div className="flex w-40 shrink-0 items-center gap-2">
                  <UserAvatar
                    name={row.name}
                    src={row.avatarUrl}
                    seed={row.userId}
                    size="sm"
                  />
                  <span className="truncate text-sm">{row.name}</span>
                </div>
                <div className="flex gap-1">
                  {row.cells.map((cell) => {
                    const cls = cell.isOffDay
                      ? "bg-slate-400"
                      : cell.empty
                        ? "bg-muted/40 border border-dashed"
                        : BUCKET_CLASS[heatBucket(cell.total)];
                    const label = cell.isOffDay
                      ? `${row.name} · ${formatDate(cell.date)} · Off-day`
                      : `${row.name} · ${formatDate(cell.date)} · ${cell.total} ${
                          cell.total === 1 ? "activity" : "activities"
                        }`;
                    return (
                      <span
                        key={cell.date}
                        title={label}
                        className={cn("size-4 rounded-[3px]", cls)}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
