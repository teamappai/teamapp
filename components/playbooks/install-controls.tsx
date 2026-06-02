"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Check, Download } from "lucide-react";

import { installPlaybookAction } from "@/app/app/playbooks/actions";
import type { InstallCapCheck } from "@/lib/playbooks/installs";
import { getPlan } from "@/lib/billing/plans";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Install button + confirmation modal + plan-cap modal (Decision 4). Used on the
 * playbook detail page and the recommended-onboarding cards. On success the user
 * is sent to /app/training to see their freshly-copied content.
 */
export function InstallControls({
  playbookId,
  sectionsCount,
  modulesCount,
  alreadyInstalled,
  redirectTo = "/app/training",
  className,
}: {
  playbookId: string;
  sectionsCount: number;
  modulesCount: number;
  alreadyInstalled: boolean;
  redirectTo?: string;
  className?: string;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [cap, setCap] = React.useState<InstallCapCheck | null>(null);
  const [pending, start] = React.useTransition();

  if (alreadyInstalled) {
    return (
      <Button disabled variant="outline" className={className}>
        <Check className="size-4" /> Already installed
      </Button>
    );
  }

  function doInstall() {
    start(async () => {
      const res = await installPlaybookAction(playbookId);
      if (res.ok) {
        setConfirmOpen(false);
        toast.success(
          "Playbook installed! Find your new training content in Training.",
        );
        router.push(redirectTo);
        router.refresh();
      } else if (res.reason === "cap") {
        setConfirmOpen(false);
        setCap(res.cap);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <>
      <Button
        className={className}
        onClick={() => setConfirmOpen(true)}
        disabled={pending}
      >
        <Download className="size-4" /> Install playbook
      </Button>

      {/* Confirmation modal */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Install playbook</DialogTitle>
            <DialogDescription>
              This will add to your workspace:
            </DialogDescription>
          </DialogHeader>
          <ul className="text-sm">
            <li>
              • {sectionsCount} training section{sectionsCount === 1 ? "" : "s"}
            </li>
            <li>
              • {modulesCount} training module{modulesCount === 1 ? "" : "s"}
            </li>
          </ul>
          <p className="text-muted-foreground text-sm">
            You can customize or delete anything after installing.
          </p>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button onClick={doInstall} disabled={pending}>
              {pending ? "Installing…" : "Install playbook"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Plan-cap modal */}
      <Dialog open={!!cap} onOpenChange={(o) => !o && setCap(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Plan limit reached</DialogTitle>
            <DialogDescription>
              {cap
                ? `You're at your ${getPlan(cap.planName).display_name} plan limit (${cap.current} installed playbooks). Upgrade to Pro for unlimited installs, or uninstall an existing playbook first.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCap(null)}>
              Close
            </Button>
            <Button asChild>
              <Link href="/app/billing?tab=plans">Upgrade to Pro</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
