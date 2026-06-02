"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { DASH_RANGE_PRESETS, type DashRange } from "@/lib/dashboards/range";
import { Button } from "@/components/ui/button";

/**
 * Date-range selector for the Phase 13 dashboards and drill-down tabs. Pushes
 * the choice into the URL so the server component refetches. An optional
 * `paramPrefix` lets a single page host independent ranges (e.g. the drill-down
 * Deals vs Activity tabs each carry their own range).
 */
export function DashDateRangeSelect({
  range,
  paramPrefix = "",
}: {
  range: DashRange;
  paramPrefix?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const k = (name: string) => (paramPrefix ? `${paramPrefix}${name}` : name);

  const setParam = React.useCallback(
    (next: Record<string, string | null>) => {
      const sp = new URLSearchParams(params.toString());
      for (const [key, v] of Object.entries(next)) {
        if (v === null) sp.delete(key);
        else sp.set(key, v);
      }
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center gap-1">
        {DASH_RANGE_PRESETS.map((p) => (
          <Button
            key={p.key}
            size="sm"
            variant={range.key === p.key ? "default" : "outline"}
            onClick={() =>
              setParam(
                p.key === "custom"
                  ? {
                      [k("range")]: "custom",
                      [k("from")]: range.from,
                      [k("to")]: range.to,
                    }
                  : { [k("range")]: p.key, [k("from")]: null, [k("to")]: null },
              )
            }
          >
            {p.label}
          </Button>
        ))}
      </div>

      {range.key === "custom" ? (
        <div className="flex items-center gap-1.5 text-sm">
          <input
            type="date"
            value={range.from}
            max={range.to}
            onChange={(e) =>
              setParam({
                [k("range")]: "custom",
                [k("from")]: e.target.value,
                [k("to")]: range.to,
              })
            }
            className="border-input bg-background rounded-md border px-2 py-1"
            aria-label="From date"
          />
          <span className="text-muted-foreground">to</span>
          <input
            type="date"
            value={range.to}
            min={range.from}
            onChange={(e) =>
              setParam({
                [k("range")]: "custom",
                [k("from")]: range.from,
                [k("to")]: e.target.value,
              })
            }
            className="border-input bg-background rounded-md border px-2 py-1"
            aria-label="To date"
          />
        </div>
      ) : null}
    </div>
  );
}
