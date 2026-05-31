import type { Metadata } from "next";

import { getSessionProfile } from "@/lib/auth/profile";
import { NotAuthorizedError } from "@/lib/auth/require-super-admin";
import { canLogActivity } from "@/lib/coaching/access";
import { createClient } from "@/lib/supabase/server";
import { getStreak } from "@/lib/coaching/streak";
import { getPipelineSummary } from "@/lib/coaching/pipeline";
import { addDaysIso, resolveRange, todayIso } from "@/lib/coaching/dates";
import {
  ACTIVITY_METRICS,
  totalActivity,
  type ActivityMetricKey,
} from "@/lib/constants/activity-metrics";
import { PageHeader } from "@/components/shared/page-header";
import {
  ActivityLogForm,
  type DayLog,
  type MetricValues,
} from "@/components/coaching/activity-log-form";
import type { WeeklyPoint } from "@/components/coaching/weekly-activity-chart";

export const metadata: Metadata = { title: "Log Activity · TeamApp" };

const METRIC_KEYS = ACTIVITY_METRICS.map((m) => m.key);

function pickValues(row: Record<string, unknown>): MetricValues {
  return METRIC_KEYS.reduce((acc, k) => {
    acc[k] = (row[k] as number) ?? 0;
    return acc;
  }, {} as MetricValues);
}

function weekdayLabel(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
  });
}

export default async function ActivityLogPage() {
  const session = await getSessionProfile();
  if (!session || !canLogActivity(session.profile.role)) {
    throw new NotAuthorizedError();
  }
  const userId = session.user.id;
  const companyId = session.profile.company_id;
  const today = todayIso();
  const minDate = addDaysIso(today, -30);

  const supabase = await createClient();
  const { data: recent } = await supabase
    .from("activity_logs")
    .select("*")
    .eq("user_id", userId)
    .gte("log_date", addDaysIso(today, -31))
    .order("log_date", { ascending: false });

  const rows = recent ?? [];
  const byDate = new Map(rows.map((r) => [r.log_date, r]));

  // Prefill map for the form (last 31 days).
  const logsByDate: Record<string, DayLog> = {};
  for (const r of rows) {
    logsByDate[r.log_date] = {
      values: pickValues(r as Record<string, unknown>),
      isOffDay: r.is_off_day,
    };
  }

  // Weekly chart: last 7 days including today, oldest → newest.
  const weekly: WeeklyPoint[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDaysIso(today, -i);
    const row = byDate.get(d);
    weekly.push({
      date: d,
      label: weekdayLabel(d),
      total:
        row && !row.is_off_day
          ? totalActivity(row as Record<ActivityMetricKey, number>)
          : 0,
      isOffDay: !!row?.is_off_day,
    });
  }

  const [streak, pipeline] = await Promise.all([
    getStreak(userId),
    getPipelineSummary({
      companyId,
      userId,
      range: resolveRange({ range: "90" }),
    }),
  ]);
  const todayLogged = byDate.has(today);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Log Activity"
        description="Track your daily prospecting funnel. Pre-filled from yesterday — just edit what's different."
      />
      <ActivityLogForm
        today={today}
        minDate={minDate}
        logsByDate={logsByDate}
        initialStreak={streak}
        initialTodayLogged={todayLogged}
        weekly={weekly}
        pipeline={pipeline}
      />
    </div>
  );
}
