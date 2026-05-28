"use client";

import * as React from "react";
import { toast } from "sonner";
import { UserCog } from "lucide-react";

import { Button } from "@/components/ui/button";
import { startImpersonation } from "@/app/app/admin/actions";

/**
 * Starts an impersonation session for the target user. On success the server
 * action replaces the session and redirects, so this only needs to surface
 * errors (e.g. trying to impersonate another super_admin).
 */
export function ImpersonateButton({
  userId,
  userName,
}: {
  userId: string;
  userName: string;
}) {
  const [pending, startTransition] = React.useTransition();

  return (
    <Button
      onClick={() =>
        startTransition(async () => {
          const result = await startImpersonation(userId);
          // A successful action redirects and never returns; reaching here is an
          // error result.
          if (result && !result.ok) toast.error(result.error);
        })
      }
      disabled={pending}
    >
      <UserCog className="size-4" />
      {pending ? "Starting…" : `Impersonate ${userName}`}
    </Button>
  );
}
