"use client";

import * as React from "react";
import Link from "next/link";

import type { DrillTraining } from "@/lib/dashboards/drill-down";
import { formatDate } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NudgeDialog } from "@/components/coaching/nudge-dialog";

const STATUS_LABEL: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
};

export function DrillDownTraining({
  training,
  agent,
  canCoach,
}: {
  training: DrillTraining;
  agent: { id: string; name: string };
  canCoach: boolean;
}) {
  const [nudge, setNudge] = React.useState(false);
  const hasStalled = training.sections.some((s) =>
    s.modules.some((m) => m.stalled),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1">
          <div className="flex justify-between text-sm">
            <span className="font-medium">Onboarding</span>
            <span className="text-muted-foreground">
              {training.summary.completed} of {training.summary.total} modules ·{" "}
              {training.summary.percent}%
            </span>
          </div>
          <Progress
            value={training.summary.percent}
            className="mt-1 h-2"
            indicatorClassName="bg-emerald-500"
          />
        </div>
        {canCoach && hasStalled ? (
          <Button size="sm" variant="outline" onClick={() => setNudge(true)}>
            Send training nudge
          </Button>
        ) : null}
      </div>

      {training.sections.map((s) => (
        <Card key={s.id}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm font-semibold">
              <span>{s.title}</span>
              <span className="text-muted-foreground text-xs font-normal">
                {s.completed}/{s.total}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {s.modules.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <Link
                  href={`/app/training/${m.id}`}
                  className="truncate hover:underline"
                >
                  {m.title}
                </Link>
                <div className="flex shrink-0 items-center gap-2">
                  {m.stalled ? (
                    <Badge variant="destructive" className="text-[10px]">
                      Stalled
                    </Badge>
                  ) : null}
                  {m.lastViewedAt ? (
                    <span className="text-muted-foreground text-xs">
                      {formatDate(m.lastViewedAt, "short")}
                    </span>
                  ) : null}
                  <Badge
                    variant={m.status === "completed" ? "default" : "secondary"}
                    className="text-[10px]"
                  >
                    {STATUS_LABEL[m.status] ?? m.status}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {canCoach ? (
        <NudgeDialog open={nudge} onOpenChange={setNudge} agent={agent} />
      ) : null}
    </div>
  );
}
