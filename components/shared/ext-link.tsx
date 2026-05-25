import { ExternalLink } from "lucide-react";

import { cn } from "@/lib/utils/index";

type ExtLinkProps = React.ComponentProps<"a"> & {
  /** Hide the trailing external-link icon (keeps the new-tab/rel behavior). */
  hideIcon?: boolean;
};

/**
 * External link that always opens in a new tab with `rel="noopener noreferrer"`
 * and shows the external-link affordance (audit F-066). Use for any URL that
 * leaves the app — notably user-authored training module link blocks.
 */
export function ExtLink({
  href,
  className,
  children,
  hideIcon,
  ...props
}: ExtLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "text-primary inline-flex items-center gap-1 underline-offset-4 hover:underline",
        className,
      )}
      {...props}
    >
      {children}
      {hideIcon ? null : (
        <ExternalLink className="size-3.5 shrink-0" aria-hidden />
      )}
    </a>
  );
}
