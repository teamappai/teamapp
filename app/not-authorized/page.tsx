import type { Metadata } from "next";
import Link from "next/link";
import { ShieldX } from "lucide-react";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Not authorized · TeamApp" };

/**
 * 403 page. Middleware rewrites `/app/admin/*` requests from non-super_admins
 * here (a rewrite, not a redirect — the URL stays put). Also reachable directly
 * as a generic forbidden page.
 */
export default function NotAuthorizedPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="bg-muted text-muted-foreground flex size-14 items-center justify-center rounded-full">
        <ShieldX className="size-7" aria-hidden />
      </div>
      <div className="space-y-1">
        <p className="text-muted-foreground text-sm font-medium">403</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Not authorized
        </h1>
        <p className="text-muted-foreground max-w-sm text-sm">
          You don&apos;t have permission to view this page. The platform admin
          console is restricted to super admins.
        </p>
      </div>
      <Button asChild>
        <Link href="/app/dashboard">Back to your dashboard</Link>
      </Button>
    </main>
  );
}
