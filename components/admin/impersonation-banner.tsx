"use client";

import { UserCog } from "lucide-react";

/**
 * Persistent banner shown on every page while a super_admin is impersonating
 * another user. "End session" POSTs to the route handler that restores the
 * admin's original session (audit CR-4). POST-only so it can't fire on prefetch.
 */
export function ImpersonationBanner({ name }: { name: string }) {
  return (
    <div className="sticky top-0 z-50 flex items-center justify-center gap-3 bg-amber-400 px-4 py-2 text-sm font-medium text-amber-950">
      <UserCog className="size-4 shrink-0" aria-hidden />
      <span>
        Impersonating <strong>{name}</strong>
      </span>
      <form action="/api/impersonate/end" method="post">
        <button
          type="submit"
          className="rounded-md bg-amber-950 px-2.5 py-1 text-xs font-semibold text-amber-50 transition-colors hover:bg-amber-900"
        >
          End session
        </button>
      </form>
    </div>
  );
}
