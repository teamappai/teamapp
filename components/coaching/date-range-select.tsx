"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { RANGE_PRESETS, type DateRange } from "@/lib/coaching/dates";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/index";

/**
 * Date-range selector for the coaching dashboard (fixes F-019/F-077). Presets
 * Last 7 / 30 / 90 / YTD / Custom; the selected state is highlighted, and
 * changing it pushes the choice into the URL so every panel refetches.
 */
export function DateRangeSelect({ range }: { range: DateRange }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const setParam = React.useCallback(
    (next: Record<string, string | null>) => {
      const sp = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(next)) {
        if (v === null) sp.delete(k);
        else sp.set(k, v);
      }
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center gap-1">
        {RANGE_PRESETS.map((p) => (
          <Button
            key={p.key}
            size="sm"
            variant={range.key === p.key ? "default" : "outline"}
            onClick={() =>
              setParam(
                p.key === "custom"
                  ? { range: "custom", from: range.from, to: range.to }
                  : { range: p.key, from: null, to: null },
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
              setParam({ range: "custom", from: e.target.value, to: range.to })
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
                range: "custom",
                from: range.from,
                to: e.target.value,
              })
            }
            className="border-input bg-background rounded-md border px-2 py-1"
            aria-label="To date"
          />
        </div>
      ) : (
        <span
          className={cn(
            "text-muted-foreground text-xs",
            "rounded-full border px-2 py-0.5",
          )}
        >
          {range.label}
        </span>
      )}
    </div>
  );
}
