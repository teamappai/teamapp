"use client";

import { Info, Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * A single daily-metric input rendered as a stepper — `– [ N ] +` — never a
 * text field (fixes F-115). Min 0, integer only. The info icon reveals the
 * metric's precise definition (fixes F-117). Buttons are 44px for thumb-tap.
 */
export function MetricStepper({
  label,
  tooltip,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  tooltip: string;
  value: number;
  onChange: (next: number) => void;
  disabled?: boolean;
}) {
  const dec = () => onChange(Math.max(0, value - 1));
  const inc = () => onChange(value + 1);

  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="truncate text-sm font-medium">{label}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={`What counts as ${label}?`}
              className="text-muted-foreground hover:text-foreground shrink-0"
            >
              <Info className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-pretty">
            {tooltip}
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-11 shrink-0"
          onClick={dec}
          disabled={disabled || value <= 0}
          aria-label={`Decrease ${label}`}
        >
          <Minus className="size-4" />
        </Button>
        <span
          className="w-10 text-center text-base font-semibold tabular-nums"
          aria-live="polite"
          aria-label={`${label}: ${value}`}
        >
          {value}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-11 shrink-0"
          onClick={inc}
          disabled={disabled}
          aria-label={`Increase ${label}`}
        >
          <Plus className="size-4" />
        </Button>
      </div>
    </div>
  );
}
