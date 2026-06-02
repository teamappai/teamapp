"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { uninstallPlaybookAction } from "@/app/app/playbooks/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function UninstallButton({
  playbookId,
  title,
}: {
  playbookId: string;
  title: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();

  function doUninstall() {
    start(async () => {
      const res = await uninstallPlaybookAction(playbookId);
      if (res.ok) {
        setOpen(false);
        toast.success(
          "Playbook uninstalled. Your training content was preserved.",
        );
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Uninstall
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Uninstall {title}?</DialogTitle>
            <DialogDescription>
              Your training content stays in your workspace. This just removes
              the link to the playbook so you can install another one.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={doUninstall}
              disabled={pending}
            >
              {pending ? "Uninstalling…" : "Uninstall"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
