/**
 * Quiet platform attribution pinned to the very bottom of the sidebar rail,
 * below the agent onboarding widget. Net-new, adjacent to F-056.
 *
 * This lives INSIDE the sidebar chrome — it is not a page footer, so F-007
 * (no content footer) still holds. Shown for every customer-facing role
 * (team_lead, agent, admin_tc, marketing); suppressed for super_admin, whose
 * top brand already shows the TeamApp wordmark (avoids duplicate branding).
 *
 * The glyph is painted with `currentColor` via a CSS mask so it matches the
 * nav text/icon color exactly in both light and dark themes (the brand ships
 * mark-dark.svg / mark-light.svg, but a single masked shape adapts to either
 * sidebar background without a hardcoded light/dark swap).
 */
export function SidebarMark() {
  return (
    <div className="flex items-center gap-1.5 px-2 pb-1 opacity-55 transition-opacity hover:opacity-100">
      <span className="text-brand-ink-muted text-[11px] leading-none">
        powered by
      </span>
      <span
        aria-hidden
        className="block h-[18px] w-5 shrink-0 bg-current"
        style={{
          maskImage: "url(/brand/mark-dark.svg)",
          WebkitMaskImage: "url(/brand/mark-dark.svg)",
          maskRepeat: "no-repeat",
          WebkitMaskRepeat: "no-repeat",
          maskPosition: "left center",
          WebkitMaskPosition: "left center",
          maskSize: "contain",
          WebkitMaskSize: "contain",
        }}
      />
      <span className="sr-only">TeamApp</span>
    </div>
  );
}
