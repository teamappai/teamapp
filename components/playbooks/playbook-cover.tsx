import { cn } from "@/lib/utils/index";
import { DEFAULT_PLAYBOOK_GRADIENT } from "@/lib/constants/playbooks";
import { PlaybookIcon } from "@/components/playbooks/playbook-icon";

/**
 * Gradient cover with a centered icon — the visual identity of a playbook.
 * Used on browse cards (h-28), the detail hero (h-40), and the admin list
 * (small square via `size="sm"`).
 */
export function PlaybookCover({
  iconName,
  gradient,
  size = "md",
  className,
}: {
  iconName: string | null | undefined;
  gradient: string | null | undefined;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const grad = gradient || DEFAULT_PLAYBOOK_GRADIENT;
  const dims =
    size === "sm"
      ? "size-10 rounded-md"
      : size === "lg"
        ? "h-40 w-full rounded-xl"
        : "h-28 w-full rounded-lg";
  const iconSize =
    size === "sm" ? "size-5" : size === "lg" ? "size-14" : "size-9";

  return (
    <div
      className={cn(
        "flex items-center justify-center bg-gradient-to-br text-white",
        grad,
        dims,
        className,
      )}
    >
      <PlaybookIcon name={iconName} className={iconSize} />
    </div>
  );
}
