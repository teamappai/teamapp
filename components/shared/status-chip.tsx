import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils/index";
import {
  humanizeStatus,
  statusVariant,
  type StatusDomain,
  type StatusVariant,
} from "@/lib/constants/status";

const chipVariants = cva(
  "inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "bg-secondary text-secondary-foreground",
        neutral: "bg-muted text-muted-foreground",
        info: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
        success:
          "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
        warning:
          "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
        danger: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
      } satisfies Record<StatusVariant, string>,
    },
    defaultVariants: { variant: "default" },
  },
);

const dotVariants: Record<StatusVariant, string> = {
  default: "bg-foreground/50",
  neutral: "bg-muted-foreground",
  info: "bg-blue-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
};

type StatusChipProps = {
  /**
   * Map a domain status string to the right variant + label automatically.
   * Pair with `status`. Pass `variant`/children directly to override.
   */
  domain?: StatusDomain;
  status?: string;
  /** Explicit variant — overrides `domain`/`status` color resolution. */
  variant?: StatusVariant;
  /** Hide the leading status dot. */
  hideDot?: boolean;
  className?: string;
  children?: React.ReactNode;
} & VariantProps<typeof chipVariants>;

/**
 * Consistent status pill used across deals, requests, users, companies, and
 * training (audit CR-8). Either pass a `domain`+`status` to auto-map the color
 * and humanized label, or supply `variant` + children directly.
 */
export function StatusChip({
  domain,
  status,
  variant,
  hideDot,
  className,
  children,
}: StatusChipProps) {
  const resolved: StatusVariant =
    variant ?? (domain && status ? statusVariant(domain, status) : "default");
  const label = children ?? (status ? humanizeStatus(status) : null);

  return (
    <span className={cn(chipVariants({ variant: resolved }), className)}>
      {hideDot ? null : (
        <span
          className={cn("size-1.5 rounded-full", dotVariants[resolved])}
          aria-hidden
        />
      )}
      {label}
    </span>
  );
}
