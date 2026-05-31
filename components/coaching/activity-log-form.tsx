"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarDays, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  ACTIVITY_GROUPS,
  metricsForGroup,
  zeroMetrics,
  type ActivityMetricKey,
} from "@/lib/constants/activity-metrics";
import { addDaysIso } from "@/lib/coaching/dates";
import { streakChipText } from "@/lib/coaching/streak-format";
import type { PipelineSummary } from "@/lib/coaching/pipeline";
import { submitActivityLog } from "@/app/app/activity-log/actions";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { MetricStepper } from "@/components/coaching/metric-stepper";
import {
  WeeklyActivityChart,
  type WeeklyPoint,
} from "@/components/coaching/weekly-activity-chart";

export type MetricValues = Record<ActivityMetricKey, number>;
export type DayLog = { values: MetricValues; isOffDay: boolean };

const PIPELINE_ROWS: Array<{ key: keyof PipelineSummary; label: string }> = [
  { key: "underContract", label: "Under Contract" },
  { key: "closedInPeriod", label: "Closed" },
  { key: "cancelledInPeriod", label: "Cancelled" },
  { key: "expiredInPeriod", label: "Expired" },
  { key: "trashInPeriod", label: "Trash" },
];

export function ActivityLogForm({
  today,
  minDate,
  logsByDate,
  initialStreak,
  initialTodayLogged,
  weekly,
  pipeline,
}: {
  today: string;
  minDate: string;
  logsByDate: Record<string, DayLog>;
  initialStreak: number;
  initialTodayLogged: boolean;
  weekly: WeeklyPoint[];
  pipeline: PipelineSummary;
}) {
  const prefillFor = React.useCallback(
    (date: string): DayLog => {
      const existing = logsByDate[date];
      if (existing) return existing;
      // New day: carry yesterday's numbers forward as a starting point (PA-5).
      const prev = logsByDate[addDaysIso(date, -1)];
      if (prev) return { values: { ...prev.values }, isOffDay: false };
      return { values: zeroMetrics(), isOffDay: false };
    },
    [logsByDate],
  );

  const [date, setDate] = React.useState(today);
  const [showPicker, setShowPicker] = React.useState(false);
  const initial = prefillFor(today);
  const [values, setValues] = React.useState<MetricValues>(initial.values);
  const [isOffDay, setIsOffDay] = React.useState(initial.isOffDay);
  const [pending, startTransition] = React.useTransition();

  const [streak, setStreak] = React.useState(initialStreak);
  const [todayLogged, setTodayLogged] = React.useState(initialTodayLogged);

  // Re-prefill whenever the selected date changes.
  const onDateChange = (next: string) => {
    if (next > today || next < minDate) return;
    setDate(next);
    const pre = prefillFor(next);
    setValues(pre.values);
    setIsOffDay(pre.isOffDay);
  };

  const setMetric = (key: ActivityMetricKey, next: number) =>
    setValues((v) => ({ ...v, [key]: next }));

  const isUpdate = !!logsByDate[date];
  const isBackDated = date !== today;

  function onSubmit() {
    startTransition(async () => {
      const res = await submitActivityLog({
        logDate: date,
        isOffDay,
        metrics: values,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
      setStreak(res.streak);
      setTodayLogged(res.todayLogged);
    });
  }

  return (
    <div className="space-y-6 pb-24 sm:pb-0">
      {/* Date + streak header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Badge variant="secondary" className="text-sm">
            {streakChipText(streak, todayLogged)}
          </Badge>
          <div className="flex items-center gap-2 text-sm">
            <button
              type="button"
              onClick={() => setShowPicker((s) => !s)}
              className="text-primary inline-flex items-center gap-1.5 font-medium hover:underline"
            >
              <CalendarDays className="size-4" />
              {isBackDated ? "Change day" : "Log a previous day"}
            </button>
            {showPicker ? (
              <input
                type="date"
                value={date}
                min={minDate}
                max={today}
                onChange={(e) => onDateChange(e.target.value)}
                className="border-input bg-background rounded-md border px-2 py-1 text-sm"
                aria-label="Log date"
              />
            ) : isBackDated ? (
              <span className="text-muted-foreground">{date}</span>
            ) : null}
          </div>
        </div>

        {/* Off-day toggle */}
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={isOffDay}
            onCheckedChange={setIsOffDay}
            aria-label="Mark this day as an off-day"
          />
          <span className="font-medium">Mark as off-day</span>
        </label>
      </div>

      {isOffDay ? (
        <p className="text-muted-foreground rounded-md border border-dashed px-3 py-2 text-sm">
          Off-day: all metrics save as 0 and this day still counts toward your
          streak.
        </p>
      ) : null}

      {/* Accordion groups */}
      <Accordion
        type="multiple"
        defaultValue={ACTIVITY_GROUPS.filter((g) => g.defaultOpen).map(
          (g) => g.key,
        )}
        className="space-y-3"
      >
        {ACTIVITY_GROUPS.map((group) => (
          <AccordionItem
            key={group.key}
            value={group.key}
            className="rounded-lg border px-4"
          >
            <AccordionTrigger className="hover:no-underline">
              <div className="text-left">
                <div className="font-semibold">{group.label}</div>
                <div className="text-muted-foreground text-xs font-normal">
                  {group.subtitle}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="divide-y">
                {metricsForGroup(group.key).map((m) => (
                  <MetricStepper
                    key={m.key}
                    label={m.label}
                    tooltip={m.tooltip}
                    value={values[m.key]}
                    onChange={(n) => setMetric(m.key, n)}
                    disabled={isOffDay}
                  />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {/* Pipeline summary (derived from deals, read-only) */}
      <Card className="gap-0 py-4">
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">
              Pipeline summary{" "}
              <span className="text-muted-foreground font-normal">
                (from your deals)
              </span>
            </h3>
            <Link
              href="/app/deals"
              className="text-primary text-xs font-medium hover:underline"
            >
              View deals
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {PIPELINE_ROWS.map((row) => (
              <div
                key={row.key}
                className="bg-muted/50 flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm"
              >
                <span className="text-muted-foreground">{row.label}</span>
                <span className="font-semibold tabular-nums">
                  {pipeline[row.key]}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Weekly mini-chart */}
      <Card className="gap-0 py-4">
        <CardContent className="space-y-2">
          <h3 className="text-sm font-semibold">
            Last 7 days, including today
          </h3>
          <WeeklyActivityChart data={weekly} />
        </CardContent>
      </Card>

      {/* Desktop submit */}
      <div className="hidden sm:flex sm:justify-end">
        <Button onClick={onSubmit} disabled={pending} size="lg">
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          {isUpdate ? "Update activity" : "Submit activity"}
        </Button>
      </div>

      {/* Sticky mobile submit */}
      <div className="bg-background/95 fixed inset-x-0 bottom-0 z-20 border-t p-3 backdrop-blur sm:hidden">
        <Button
          onClick={onSubmit}
          disabled={pending}
          className="w-full"
          size="lg"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          {isUpdate ? "Update activity" : "Submit activity"}
        </Button>
      </div>
    </div>
  );
}
