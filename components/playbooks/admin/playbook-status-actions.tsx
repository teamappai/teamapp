"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { PlaybookStatus } from "@/lib/constants/playbooks";
import { setPlaybookStatusAction } from "@/app/app/admin/playbooks/actions";
import { Button } from "@/components/ui/button";

/**
 * Lifecycle controls for a playbook (draft → published → archived, reversible).
 * Shows the relevant primary action(s) for the current status.
 */
export function PlaybookStatusActions({
  playbookId,
  status,
}: {
  playbookId: string;
  status: PlaybookStatus;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();

  function setStatus(next: PlaybookStatus, label: string) {
    start(async () => {
      const res = await setPlaybookStatusAction(playbookId, next);
      if (res.ok) {
        toast.success(label);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="flex gap-2">
      {status === "draft" && (
        <Button
          disabled={pending}
          onClick={() => setStatus("published", "Playbook published.")}
        >
          Publish
        </Button>
      )}
      {status === "published" && (
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => setStatus("archived", "Playbook archived.")}
        >
          Archive
        </Button>
      )}
      {status === "archived" && (
        <Button
          disabled={pending}
          onClick={() => setStatus("published", "Playbook republished.")}
        >
          Republish
        </Button>
      )}
    </div>
  );
}
