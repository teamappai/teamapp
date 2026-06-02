"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { UserRole } from "@/lib/constants/roles";
import type {
  PlaybookModule,
  PlaybookSectionWithCount,
} from "@/lib/playbooks/content";
import { savePlaybookModuleAction } from "@/app/app/admin/playbooks/actions";
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

export function PlaybookModuleDrawer({
  open,
  onOpenChange,
  playbookId,
  module,
  sections,
  defaultSectionId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playbookId: string;
  module: PlaybookModule | null;
  sections: PlaybookSectionWithCount[];
  defaultSectionId?: string;
}) {
  const router = useRouter();
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [sectionId, setSectionId] = React.useState("");
  const [minutes, setMinutes] = React.useState("");
  const [roles, setRoles] = React.useState<UserRole[]>([]);
  const [blocks, setBlocks] = React.useState<ContentBlock[]>([]);
  const [error, setError] = React.useState<string>();
  const [pending, start] = React.useTransition();
  // Stable storage folder id — module id when editing, else a fresh uuid. The
  // playbook id is the company-segment of the module-content path (super_admin
  // passes the bucket write policy via is_super_admin()).
  const folderId = React.useMemo(
    () => module?.id ?? crypto.randomUUID(),
    [module],
  );

  React.useEffect(() => {
    if (open) {
      setTitle(module?.title ?? "");
      setDescription(module?.description ?? "");
      setSectionId(
        module?.playbook_section_id ??
          defaultSectionId ??
          sections[0]?.id ??
          "",
      );
      setMinutes(module?.estimated_minutes?.toString() ?? "");
      setRoles(module?.visible_to_roles ?? []);
      setBlocks(parseBlocks(module?.content));
      setError(undefined);
    }
  }, [open, module, defaultSectionId, sections]);

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
      const res = await savePlaybookModuleAction(playbookId, {
        id: module?.id,
        title: title.trim(),
        description: description.trim(),
        sectionId,
        estimatedMinutes: minutes.trim() ? Number(minutes) : null,
        visibleToRoles: roles,
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
            <Label htmlFor="pmod-title">Title</Label>
            <Input
              id="pmod-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Lesson 1 — Getting started"
            />
          </div>
          <div>
            <Label htmlFor="pmod-desc">Description (optional)</Label>
            <Textarea
              id="pmod-desc"
              value={description}
              rows={2}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="pmod-section">Section</Label>
            <Select value={sectionId} onValueChange={setSectionId}>
              <SelectTrigger id="pmod-section">
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
          <div>
            <Label htmlFor="pmod-minutes">Estimated time</Label>
            <div className="flex items-center gap-2">
              <Input
                id="pmod-minutes"
                type="number"
                min={0}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                placeholder="30"
              />
              <span className="text-muted-foreground text-sm">min</span>
            </div>
          </div>
          <RoleMultiSelect
            value={roles}
            onChange={setRoles}
            label="Visible to (optional override)"
          />

          <BlockEditor
            blocks={blocks}
            onChange={setBlocks}
            companyId={playbookId}
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
