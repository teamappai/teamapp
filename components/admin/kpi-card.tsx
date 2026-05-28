import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils/index";

type KpiCardProps = {
  label: string;
  value: string;
  /** Smaller supporting line under the value (e.g. status breakdown). */
  hint?: React.ReactNode;
  className?: string;
};

/** Single platform-health metric tile for the admin home. */
export function KpiCard({ label, value, hint, className }: KpiCardProps) {
  return (
    <Card className={cn("gap-0 py-4", className)}>
      <CardContent className="space-y-1">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {label}
        </p>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        {hint ? (
          <div className="text-muted-foreground text-xs">{hint}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}
