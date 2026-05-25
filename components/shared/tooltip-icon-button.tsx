"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type TooltipIconButtonProps = React.ComponentProps<typeof Button> & {
  /** Accessible label — required so the icon-only button is never silent. */
  "aria-label": string;
  /** Tooltip text; falls back to the aria-label when omitted. */
  tooltip?: React.ReactNode;
  /** Tooltip placement. */
  side?: "top" | "right" | "bottom" | "left";
};

/**
 * Icon-only button that is always labelled and tooltipped (audit CR-9). Wrap
 * every bare arrow/pencil/trash/key icon button in this — never ship an
 * unlabeled icon button. Defaults to `variant="ghost"` `size="icon"`.
 */
export function TooltipIconButton({
  tooltip,
  side = "top",
  variant = "ghost",
  size = "icon",
  children,
  ...props
}: TooltipIconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant={variant} size={size} {...props}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side={side}>
        {tooltip ?? props["aria-label"]}
      </TooltipContent>
    </Tooltip>
  );
}
