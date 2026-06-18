"use client";

import Link from "next/link";
import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * App-wide 500 boundary. Catches uncaught render/runtime errors and replaces the
 * raw Next.js error overlay with a branded, friendly page that matches the 403
 * (`/not-authorized`) and 404 (`not-found.tsx`) layouts. Must be a Client
 * Component (Next.js requirement for error boundaries).
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the error to the console for diagnostics; production wiring to an
    // error tracker can hook in here later.
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="bg-muted text-muted-foreground flex size-14 items-center justify-center rounded-full">
        <TriangleAlert className="size-7" aria-hidden />
      </div>
      <div className="space-y-1">
        <p className="text-muted-foreground text-sm font-medium">500</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Something went wrong
        </h1>
        <p className="text-muted-foreground max-w-sm text-sm">
          An unexpected error occurred on our end. You can try again, or head
          back home and pick up where you left off.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button asChild variant="outline">
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </main>
  );
}
