"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { archiveChannel } from "@/app/app/messages/actions";

/**
 * Destructive "Archive" (= permanent delete, Decision 10). The typed "ARCHIVE"
 * confirmation prevents accidents; the button stays disabled until it matches.
 */
export function ArchiveChannelDialog({
  channelId,
  channelName,
  messageCount,
  open,
  onOpenChange,
}: {
  channelId: string;
  channelName: string;
  messageCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [confirm, setConfirm] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) setConfirm("");
  }, [open]);

  const submit = async () => {
    setSubmitting(true);
    const res = await archiveChannel({ channelId, confirm: "ARCHIVE" });
    setSubmitting(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`#${channelName} archived.`);
    onOpenChange(false);
    router.push("/app/messages");
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TriangleAlert className="text-destructive size-5" />
            Archive #{channelName}?
          </DialogTitle>
          <DialogDescription>
            This permanently deletes the channel and all {messageCount} message
            {messageCount === 1 ? "" : "s"}. This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <label className="text-sm">
            Type <span className="font-semibold">ARCHIVE</span> to confirm.
          </label>
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoFocus
            placeholder="ARCHIVE"
            className="border-input focus-visible:ring-destructive h-9 w-full rounded-md border bg-transparent px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={confirm !== "ARCHIVE" || submitting}
            onClick={() => void submit()}
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "Archive channel"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
