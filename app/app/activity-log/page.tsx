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
  GROUP_METRIC_KEYS,
  totalActivity,
  type ActivityGroupKey,
  type ActivityMetricKey,
} from "@/lib/constants/activity-metrics";
import { PageHeader } from "@/components/shared/page-header";
import { formatDate } from "@/lib/utils/format";
import { TrackOnMount } from "@/components/posthog/track-on-mount";
import {
  ActivityLogForm,
  type DayLog,
  type MetricValues,
  type YesterdayReference,
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
  return formatDate(iso, "weekday");
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

  // Saved logs by date — used only to re-open a day that was already logged
  // (editing/correcting). New days no longer carry yesterday's numbers forward
  // (Phase 14 daily-reset, USER OVERRIDE): each day starts at 0.
  const logsByDate: Record<string, DayLog> = {};
  for (const r of rows) {
    logsByDate[r.log_date] = {
      values: pickValues(r as Record<string, unknown>),
      isOffDay: r.is_off_day,
    };
  }

  // Yesterday's totals — shown as a read-only REFERENCE card below the form
  // (never pre-filled into the inputs).
  const yesterdayIso = addDaysIso(today, -1);
  const yRow = byDate.get(yesterdayIso);
  const groupTotals = (row: Record<ActivityMetricKey, number>) =>
    (Object.keys(GROUP_METRIC_KEYS) as ActivityGroupKey[]).reduce(
      (acc, g) => {
        acc[g] = GROUP_METRIC_KEYS[g].reduce((s, k) => s + (row[k] ?? 0), 0);
        return acc;
      },
      {} as Record<ActivityGroupKey, number>,
    );
  const yesterday: YesterdayReference = yRow
    ? {
        date: yesterdayIso,
        logged: true,
        isOffDay: yRow.is_off_day,
        total: yRow.is_off_day
          ? 0
          : totalActivity(yRow as Record<ActivityMetricKey, number>),
        groups: yRow.is_off_day
          ? { top_of_funnel: 0, appointments: 0, pipeline: 0 }
          : groupTotals(yRow as Record<ActivityMetricKey, number>),
      }
    : {
        date: yesterdayIso,
        logged: false,
        isOffDay: false,
        total: 0,
        groups: { top_of_funnel: 0, appointments: 0, pipeline: 0 },
      };

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
      <TrackOnMount
        event="activity_log_opened"
        properties={{ source: "sidebar", role: session.profile.role }}
      />
      <PageHeader
        title="Log Activity"
        description="Track your daily prospecting funnel. Each day starts fresh — log what you actually did today."
      />
      <ActivityLogForm
        today={today}
        minDate={minDate}
        logsByDate={logsByDate}
        initialStreak={streak}
        initialTodayLogged={todayLogged}
        weekly={weekly}
        pipeline={pipeline}
        yesterday={yesterday}
      />
    </div>
  );
}
