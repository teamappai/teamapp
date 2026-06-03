"use client";

import * as React from "react";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Header, type HeaderIdentity } from "@/components/layout/header";
import type { NotificationItem } from "@/components/layout/notification-bell";
import {
  SidebarContent,
  type SidebarData,
} from "@/components/layout/sidebar-content";

/**
 * Authenticated app chrome: a persistent 240px sidebar on desktop, a top header
 * row, and the page content. Below 1024px the sidebar collapses into a
 * hamburger-triggered slide-in drawer (audit F-002). No footer here (F-007) —
 * legal links live in the header user menu.
 */
export function AppShell({
  sidebar,
  identity,
  unreadCount,
  notifications,
  children,
}: {
  sidebar: SidebarData;
  identity: HeaderIdentity;
  unreadCount?: number;
  notifications?: NotificationItem[];
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Skip link — first focusable element, visible on focus (WCAG 2.4.1). */}
      <a
        href="#main-content"
        className="bg-background focus-visible:ring-ring sr-only z-50 rounded-md border px-4 py-2 text-sm font-medium shadow focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus-visible:ring-2 focus-visible:outline-none"
      >
        Skip to main content
      </a>
      <aside className="border-sidebar-border hidden w-60 shrink-0 border-r lg:block">
        <div className="sticky top-0 h-screen">
          <SidebarContent data={sidebar} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          identity={identity}
          navItems={sidebar.navItems}
          unreadCount={unreadCount}
          notifications={notifications}
          onMenuClick={() => setDrawerOpen(true)}
        />
        <main id="main-content" className="flex-1 px-4 py-6 sm:px-6">
          {children}
        </main>
      </div>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="w-72 gap-0 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarContent
            data={sidebar}
            onNavigate={() => setDrawerOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
