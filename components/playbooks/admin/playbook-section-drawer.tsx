"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { UserRole } from "@/lib/constants/roles";
import type { PlaybookSectionWithCount } from "@/lib/playbooks/content";
import { savePlaybookSectionAction } from "@/app/app/admin/playbooks/actions";
import { RoleMultiSelect } from "@/components/team/role-multiselect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export function PlaybookSectionDrawer({
  open,
  onOpenChange,
  playbookId,
  section,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playbookId: string;
  section: PlaybookSectionWithCount | null;
}) {
  const router = useRouter();
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [roles, setRoles] = React.useState<UserRole[]>([]);
  const [minutes, setMinutes] = React.useState("");
  const [timelineDays, setTimelineDays] = React.useState("");
  const [error, setError] = React.useState<string>();
  const [pending, start] = React.useTransition();

  React.useEffect(() => {
    if (open) {
      setTitle(section?.title ?? "");
      setDescription(section?.description ?? "");
      setRoles(section?.visible_to_roles ?? []);
      setMinutes(section?.estimated_minutes?.toString() ?? "");
      setTimelineDays(section?.recommended_timeline_days?.toString() ?? "");
      setError(undefined);
    }
  }, [open, section]);

  function submit() {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    start(async () => {
      const res = await savePlaybookSectionAction(playbookId, {
        id: section?.id,
        title: title.trim(),
        description: description.trim(),
        visibleToRoles: roles,
        estimatedMinutes: minutes.trim() ? Number(minutes) : null,
        recommendedTimelineDays: timelineDays.trim()
          ? Number(timelineDays)
          : null,
      });
      if (res.ok) {
        toast.success(section ? "Section updated." : "Section created.");
        router.refresh();
        onOpenChange(false);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{section ? "Edit section" : "Add section"}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-4">
          <div>
            <Label htmlFor="sec-title">Title</Label>
            <Input
              id="sec-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Week 1 — Foundations"
            />
          </div>
          <div>
            <Label htmlFor="sec-desc">Description (optional)</Label>
            <Textarea
              id="sec-desc"
              value={description}
              rows={2}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="sec-minutes">Estimated time</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="sec-minutes"
                  type="number"
                  min={0}
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  placeholder="60"
                />
                <span className="text-muted-foreground text-sm">min</span>
              </div>
            </div>
            <div>
              <Label htmlFor="sec-timeline">Recommended timeline</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="sec-timeline"
                  type="number"
                  min={0}
                  value={timelineDays}
                  onChange={(e) => setTimelineDays(e.target.value)}
                  placeholder="7"
                />
                <span className="text-muted-foreground text-sm">days</span>
              </div>
            </div>
          </div>
          <RoleMultiSelect
            value={roles}
            onChange={setRoles}
            label="Visible to (empty = all roles)"
          />
          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>
        <SheetFooter>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button onClick={submit} disabled={pending}>
              {pending ? "Saving…" : "Save section"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
