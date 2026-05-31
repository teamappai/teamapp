"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatDate } from "@/lib/utils/format";

export type WeeklyPoint = {
  /** YYYY-MM-DD */
  date: string;
  /** Short axis label, e.g. "Mon". */
  label: string;
  total: number;
  isOffDay: boolean;
};

const ACTIVE = "#16a34a"; // green-600
const OFF_DAY = "#9ca3af"; // gray-400

/**
 * Bar chart of the last 7 days' total activity (sum of all 15 manual metrics).
 * Off-days render gray-zero; worked days render green. "Last 7 days, including
 * today." (PA-5)
 */
export function WeeklyActivityChart({ data }: { data: WeeklyPoint[] }) {
  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 0, left: -20 }}
        >
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            fontSize={12}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            fontSize={12}
            width={32}
          />
          <Tooltip
            cursor={{ fill: "rgba(0,0,0,0.04)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as WeeklyPoint;
              return (
                <div className="bg-popover text-popover-foreground rounded-md border px-2.5 py-1.5 text-xs shadow-sm">
                  <div className="font-medium">{formatDate(p.date)}</div>
                  <div className="text-muted-foreground">
                    {p.isOffDay
                      ? "Off-day"
                      : `${p.total} ${p.total === 1 ? "activity" : "activities"}`}
                  </div>
                </div>
              );
            }}
          />
          <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={40}>
            {data.map((d) => (
              <Cell key={d.date} fill={d.isOffDay ? OFF_DAY : ACTIVE} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
