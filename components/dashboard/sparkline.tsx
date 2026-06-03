"use client";

import { Bar, BarChart, Cell, ResponsiveContainer } from "recharts";

/**
 * Tiny 12-point bar sparkline for the KPI cards. Purely decorative trend cue —
 * no axes, no tooltip. The most recent bar is emphasized.
 */
export function Sparkline({
  data,
  className,
}: {
  data: number[];
  className?: string;
}) {
  const points = data.map((v, i) => ({ i, v }));
  const lastIndex = points.length - 1;
  return (
    <div className={className ?? "h-8 w-full"}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={points}
          margin={{ top: 2, right: 0, bottom: 0, left: 0 }}
        >
          <Bar dataKey="v" radius={[1, 1, 0, 0]} isAnimationActive={false}>
            {points.map((p) => (
              <Cell
                key={p.i}
                fill={
                  p.i === lastIndex
                    ? "var(--primary)"
                    : "var(--muted-foreground)"
                }
                fillOpacity={p.i === lastIndex ? 0.9 : 0.3}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
