"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  MessageSquare,
  Scale,
  Search,
  User,
} from "lucide-react";

import { cn } from "@/lib/utils/index";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/shared/user-avatar";
import { TooltipIconButton } from "@/components/shared/tooltip-icon-button";
import { ROLE_LABELS, type UserRole } from "@/lib/constants/roles";
import { isNavItemActive } from "@/components/layout/nav-link";
import type { NavItem } from "@/lib/constants/nav";

export type HeaderIdentity = {
  name: string | null;
  role: UserRole;
  avatarUrl: string | null;
  /** Stable seed for the avatar fallback color (user id). */
  seed: string | null;
};

/** The user identity block — visible on EVERY authenticated screen (audit F-005). */
function UserMenu({ identity }: { identity: HeaderIdentity }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-2 rounded-md py-1 pr-1 pl-1.5 text-left transition-colors outline-none",
            "hover:bg-accent focus-visible:ring-ring focus-visible:ring-2",
          )}
        >
          <UserAvatar
            name={identity.name}
            src={identity.avatarUrl}
            seed={identity.seed}
            size="sm"
          />
          <span className="hidden min-w-0 flex-col leading-tight sm:flex">
            <span className="truncate text-sm font-medium">
              {identity.name ?? "Account"}
            </span>
            <span className="text-muted-foreground truncate text-xs">
              {ROLE_LABELS[identity.role]}
            </span>
          </span>
          <ChevronDown className="text-muted-foreground size-4 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate">{identity.name ?? "Account"}</span>
          <span className="text-muted-foreground text-xs font-normal">
            {ROLE_LABELS[identity.role]}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/app/profile">
            <User className="size-4" />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Scale className="size-4" />
            Legal
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem asChild>
              <Link href="/terms">Terms of Service</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/privacy">Privacy Policy</Link>
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild variant="destructive">
          <form action="/logout" method="post" className="w-full">
            <button type="submit" className="flex w-full items-center gap-2">
              <LogOut className="size-4" />
              Sign out
            </button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Header({
  identity,
  navItems,
  unreadCount = 0,
  onMenuClick,
}: {
  identity: HeaderIdentity;
  navItems: NavItem[];
  unreadCount?: number;
  /** Opens the mobile nav drawer. */
  onMenuClick?: () => void;
}) {
  const pathname = usePathname();
  const active = navItems.find((item) => isNavItemActive(item, pathname));

  return (
    <header className="bg-background sticky top-0 z-30 flex h-14 items-center gap-2 border-b px-3 sm:px-4">
      <TooltipIconButton
        aria-label="Open navigation"
        tooltip="Menu"
        onClick={onMenuClick}
        className="lg:hidden"
      >
        <Menu className="size-5" />
      </TooltipIconButton>

      {/* Page title slot (left) */}
      <div className="min-w-0">
        <span className="truncate text-sm font-semibold">{active?.label}</span>
      </div>

      {/* Search slot (center) — placeholder only, no functionality yet */}
      <div className="mx-2 hidden flex-1 justify-center md:flex">
        <div
          aria-hidden
          className="text-muted-foreground bg-muted/40 flex h-9 w-full max-w-md items-center gap-2 rounded-md border px-3 text-sm"
        >
          <Search className="size-4" />
          <span>Search…</span>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <TooltipIconButton aria-label="Notifications" tooltip="Notifications">
          <Bell className="size-5" />
        </TooltipIconButton>

        <div className="relative">
          <TooltipIconButton aria-label="Messages" tooltip="Messages" asChild>
            <Link href="/app/messages">
              <MessageSquare className="size-5" />
            </Link>
          </TooltipIconButton>
          {unreadCount > 0 ? (
            <span className="bg-destructive pointer-events-none absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </div>

        <div className="ml-1 sm:ml-2">
          <UserMenu identity={identity} />
        </div>
      </div>
    </header>
  );
}
