"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { ModuleRow } from "@/lib/team/modules";
import type { SectionRow, PublishStatus } from "@/lib/team/sections";
import type { UserRole } from "@/lib/constants/roles";
import { saveModule } from "@/app/app/management/actions";
import { parseBlocks, type ContentBlock } from "@/lib/team/content";
import { BlockEditor } from "@/components/team/block-editor";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Tiny common-typo dictionary for the client-side title spell-check (warn only).
const COMMON_TYPOS: Record<string, string> = {
  trainning: "training",
  onbording: "onboarding",
  managment: "management",
  recieve: "receive",
  seperate: "separate",
  agreeement: "agreement",
  comission: "commission",
  occured: "occurred",
};

function findTypos(text: string): string[] {
  return [...new Set(text.toLowerCase().match(/[a-z']+/g) ?? [])]
    .filter((w) => COMMON_TYPOS[w])
    .map((w) => `“${w}” → “${COMMON_TYPOS[w]}”`);
}

export function ModuleDrawer({
  open,
  onOpenChange,
  module,
  sections,
  companyId,
  defaultSectionId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  module: ModuleRow | null;
  sections: SectionRow[];
  companyId: string;
  defaultSectionId?: string;
}) {
  const router = useRouter();
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [sectionId, setSectionId] = React.useState("");
  const [minutes, setMinutes] = React.useState("");
  const [timelineDays, setTimelineDays] = React.useState("");
  const [roles, setRoles] = React.useState<UserRole[]>([]);
  const [status, setStatus] = React.useState<PublishStatus>("draft");
  const [blocks, setBlocks] = React.useState<ContentBlock[]>([]);
  const [error, setError] = React.useState<string>();
  const [pending, start] = React.useTransition();
  // Stable folder id for uploads — module id when editing, else a fresh uuid.
  const folderId = React.useMemo(
    () => module?.id ?? crypto.randomUUID(),
    [module],
  );

  React.useEffect(() => {
    if (open) {
      setTitle(module?.title ?? "");
      setDescription(module?.description ?? "");
      setSectionId(
        module?.section_id ?? defaultSectionId ?? sections[0]?.id ?? "",
      );
      setMinutes(module?.estimated_minutes?.toString() ?? "");
      setTimelineDays(module?.recommended_timeline_days?.toString() ?? "");
      setRoles(module?.visible_to_roles ?? []);
      setStatus(module?.status ?? "draft");
      setBlocks(parseBlocks(module?.content));
      setError(undefined);
    }
  }, [open, module, defaultSectionId, sections]);

  const typos = findTypos(title);

  function submit() {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!sectionId) {
      setError("Choose a section.");
      return;
    }
    start(async () => {
      const res = await saveModule({
        id: module?.id,
        title: title.trim(),
        description: description.trim(),
        sectionId,
        estimatedMinutes: minutes.trim() ? Number(minutes) : null,
        recommendedTimelineDays: timelineDays.trim()
          ? Number(timelineDays)
          : null,
        visibleToRoles: roles,
        status,
        content: blocks,
      });
      if (res.ok) {
        toast.success(module ? "Module updated." : "Module created.");
        router.refresh();
        onOpenChange(false);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{module ? "Edit module" : "Add module"}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-4">
          <div>
            <Label htmlFor="mod-title">Title</Label>
            <Input
              id="mod-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Lesson 1 — Getting started"
            />
            {typos.length > 0 && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                Possible typo: {typos.join(", ")}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="mod-desc">Description (optional)</Label>
            <Textarea
              id="mod-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div>
            <Label htmlFor="mod-section">Section</Label>
            <Select value={sectionId} onValueChange={setSectionId}>
              <SelectTrigger id="mod-section">
                <SelectValue placeholder="Choose a section" />
              </SelectTrigger>
              <SelectContent>
                {sections.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="mod-minutes">Estimated time</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="mod-minutes"
                  type="number"
                  min={0}
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  placeholder="30"
                />
                <span className="text-muted-foreground text-sm">min</span>
              </div>
            </div>
            <div>
              <Label htmlFor="mod-timeline">Recommended timeline</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="mod-timeline"
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
            label="Visible to (optional override)"
          />
          <div>
            <Label htmlFor="mod-status">Status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as PublishStatus)}
            >
              <SelectTrigger id="mod-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <BlockEditor
            blocks={blocks}
            onChange={setBlocks}
            companyId={companyId}
            sectionId={sectionId}
            moduleFolderId={folderId}
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
              {pending ? "Saving…" : "Save module"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
