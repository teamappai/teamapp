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
        <main className="flex-1 px-4 py-6 sm:px-6">{children}</main>
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
