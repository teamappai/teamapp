"use client";

import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Small "i" affordance that reveals a KPI's precise definition on hover/focus.
 * Definition text comes from /lib/constants/kpi-definitions.ts via the card.
 */
export function InfoTooltip({ label, note }: { label: string; note?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="What does this mean?"
          className="text-muted-foreground hover:text-foreground inline-flex"
        >
          <Info className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p>{label}</p>
        {note ? <p className="mt-1 font-medium">{note}</p> : null}
      </TooltipContent>
    </Tooltip>
  );
}
