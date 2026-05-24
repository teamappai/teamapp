import Link from "next/link";
import { cn } from "@/lib/utils/index";

/** The TeamApp wordmark. Links to the marketing root by default. */
export function Wordmark({
  href = "/",
  className,
}: {
  href?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center text-xl font-semibold tracking-tight",
        className,
      )}
    >
      Team<span className="text-primary">App</span>
    </Link>
  );
}
