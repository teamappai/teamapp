import Image from "next/image";
import Link from "next/link";
import { FilePlus2, Plus, UserPlus } from "lucide-react";

import { cn } from "@/lib/utils/index";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/shared/wordmark";
import { NavLink } from "@/components/layout/nav-link";
import { OnboardingWidget } from "@/components/layout/onboarding-widget";
import { SidebarMark } from "@/components/layout/sidebar-mark";
import type { NavItem, SidebarCta } from "@/lib/constants/nav";
import type { UserRole } from "@/lib/constants/roles";
import type { OnboardingProgress } from "@/lib/training/progress";

const CTA_ICONS = {
  plus: Plus,
  deal: FilePlus2,
  invite: UserPlus,
} as const;

export type SidebarData = {
  role: UserRole;
  /** Company brand (non-super_admin). */
  companyName: string | null;
  logoUrl: string | null;
  navItems: NavItem[];
  cta: SidebarCta | null;
  /** Agent only — null for every other role (no "0 of 0" widget). */
  onboarding: OnboardingProgress | null;
};

function SidebarBrand({
  role,
  companyName,
  logoUrl,
}: Pick<SidebarData, "role" | "companyName" | "logoUrl">) {
  // super_admin is platform staff — show the TeamApp wordmark (audit F-056).
  if (role === "super_admin") {
    return <Wordmark href="/app/admin" />;
  }

  if (logoUrl) {
    return (
      <Link href="/app/dashboard" className="flex items-center">
        <Image
          src={logoUrl}
          alt={companyName ?? "Company logo"}
          width={140}
          height={32}
          className="h-8 w-auto object-contain"
        />
      </Link>
    );
  }

  // Fall back to the company name when no logo is set.
  return (
    <Link
      href="/app/dashboard"
      className="truncate text-lg font-semibold tracking-tight"
    >
      {companyName ?? "TeamApp"}
    </Link>
  );
}

/**
 * The sidebar body shared by the desktop rail and the mobile drawer: brand
 * logo, role-aware primary CTA, role-filtered nav, and (agents only) the
 * onboarding widget pinned to the bottom.
 */
export function SidebarContent({
  data,
  onNavigate,
}: {
  data: SidebarData;
  onNavigate?: () => void;
}) {
  const { role, companyName, logoUrl, navItems, cta, onboarding } = data;
  const CtaIcon = cta?.icon ? CTA_ICONS[cta.icon] : null;

  return (
    <div className="bg-sidebar text-sidebar-foreground flex h-full flex-col gap-4 p-3">
      <div className="flex h-12 items-center px-2">
        <SidebarBrand role={role} companyName={companyName} logoUrl={logoUrl} />
      </div>

      {cta ? (
        <Button asChild className="w-full justify-center">
          <Link href={cta.href} onClick={onNavigate}>
            {CtaIcon ? <CtaIcon className="size-4" /> : null}
            {cta.label}
          </Link>
        </Button>
      ) : null}

      <nav className="flex-1 space-y-1 overflow-y-auto" aria-label="Primary">
        {navItems.map((item) => (
          <NavLink key={item.href} item={item} onNavigate={onNavigate} />
        ))}
      </nav>

      {onboarding ? (
        <div className={cn("mt-auto")}>
          <OnboardingWidget progress={onboarding} onNavigate={onNavigate} />
        </div>
      ) : null}

      {/* Quiet platform attribution at the very bottom of the rail (below the
          onboarding widget). Suppressed for super_admin — their top brand is
          already the TeamApp wordmark. Inside the sidebar chrome, not a page
          footer, so F-007 still holds. */}
      {role !== "super_admin" ? <SidebarMark /> : null}
    </div>
  );
}
