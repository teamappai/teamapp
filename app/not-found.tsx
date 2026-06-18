import type { Metadata } from "next";
import Link from "next/link";
import { Compass } from "lucide-react";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found · TeamApp" };

/**
 * App-wide 404. Rendered for any unmatched route. Mirrors the branded layout of
 * the 403 (`/not-authorized`) and 500 (`error.tsx`) pages so every dead end
 * reads as part of the product, not a raw framework error.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="bg-muted text-muted-foreground flex size-14 items-center justify-center rounded-full">
        <Compass className="size-7" aria-hidden />
      </div>
      <div className="space-y-1">
        <p className="text-muted-foreground text-sm font-medium">404</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Page not found
        </h1>
        <p className="text-muted-foreground max-w-sm text-sm">
          We couldn&apos;t find the page you were looking for. It may have been
          moved, or the link might be out of date.
        </p>
      </div>
      <Button asChild>
        <Link href="/">Go home</Link>
      </Button>
    </main>
  );
}
