"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { NUDGE_REASONS } from "@/lib/validations/coaching";
import { sendNudge } from "@/app/app/coaching/actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Reason = (typeof NUDGE_REASONS)[number]["value"];

/** Send a nudge to an agent — writes a notification + audit entry (Decision 6). */
export function NudgeDialog({
  open,
  onOpenChange,
  agent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: { id: string; name: string } | null;
}) {
  const [reason, setReason] = React.useState<Reason>("stalled_activity");
  const [message, setMessage] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function onSend() {
    if (!agent) return;
    startTransition(async () => {
      const res = await sendNudge({
        agentUserId: agent.id,
        reason,
        customMessage: message,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Nudge sent to ${agent.name}`);
      setMessage("");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send a nudge</DialogTitle>
          <DialogDescription>
            {agent ? `Give ${agent.name} a friendly push.` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Select
              value={reason}
              onValueChange={(v) => setReason(v as Reason)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NUDGE_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nudge-message">Personal message (optional)</Label>
            <Textarea
              id="nudge-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a quick note…"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSend} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
