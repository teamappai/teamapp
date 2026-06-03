import Link from "next/link";
import { Button } from "@/components/ui/button";

export type QuickAction = { label: string; href: string; primary?: boolean };

/** Role-specific primary actions row (fixes F-017). */
export function QuickActions({ actions }: { actions: QuickAction[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((a) => (
        <Button
          key={a.href + a.label}
          asChild
          size="sm"
          variant={a.primary ? "default" : "outline"}
        >
          <Link href={a.href}>{a.label}</Link>
        </Button>
      ))}
    </div>
  );
}
