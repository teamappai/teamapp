"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { addCoachingNote } from "@/app/app/coaching/actions";
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

/**
 * Add a coaching note about an agent. Notes are visible to the agent (Decision
 * 8 — no private/internal distinction), so the copy makes that explicit. Pass a
 * fixed `agent` (from a leaderboard row) or a list of `agents` to pick from
 * (from the coaching-log section).
 */
export function CoachingNoteDialog({
  open,
  onOpenChange,
  agent,
  agents,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent?: { id: string; name: string } | null;
  agents?: { id: string; name: string }[];
}) {
  const [body, setBody] = React.useState("");
  const [picked, setPicked] = React.useState<string>("");
  const [pending, startTransition] = React.useTransition();

  const agentId = agent?.id ?? picked;

  function onSave() {
    if (!agentId) {
      toast.error("Pick an agent.");
      return;
    }
    startTransition(async () => {
      const res = await addCoachingNote({ agentUserId: agentId, body });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Coaching note added");
      setBody("");
      setPicked("");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add coaching note</DialogTitle>
          <DialogDescription>
            {agent ? `For ${agent.name}. ` : ""}The agent can see this note.
          </DialogDescription>
        </DialogHeader>

        {!agent && agents ? (
          <div className="space-y-1.5">
            <Label>Agent</Label>
            <Select value={picked} onValueChange={setPicked}>
              <SelectTrigger>
                <SelectValue placeholder="Pick an agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="note-body">Note</Label>
          <Textarea
            id="note-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What did you discuss? What's the focus for next week?"
            rows={4}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={pending || !body.trim()}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Save note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
