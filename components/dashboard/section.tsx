import { cn } from "@/lib/utils/index";

/**
 * A titled dashboard section. The optional subtitle is REVIEWED copy — every
 * section passes its own correct subtitle (fixes the F-057 copy-paste bug where
 * the Team Performance table carried the marketing-requests subtitle).
 */
export function DashSection({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          {subtitle ? (
            <p className="text-muted-foreground text-sm">{subtitle}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
