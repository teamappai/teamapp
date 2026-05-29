"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { SectionRow, PublishStatus } from "@/lib/team/sections";
import type { UserRole } from "@/lib/constants/roles";
import { saveSection } from "@/app/app/management/actions";
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

export function SectionDrawer({
  open,
  onOpenChange,
  section,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  section: SectionRow | null;
}) {
  const router = useRouter();
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [roles, setRoles] = React.useState<UserRole[]>([]);
  const [status, setStatus] = React.useState<PublishStatus>("draft");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, start] = React.useTransition();

  React.useEffect(() => {
    if (open) {
      setTitle(section?.title ?? "");
      setDescription(section?.description ?? "");
      setRoles(section?.visible_to_roles ?? []);
      setStatus(section?.status ?? "draft");
      setErrors({});
    }
  }, [open, section]);

  function submit() {
    if (!title.trim()) {
      setErrors({ title: "Title is required." });
      return;
    }
    start(async () => {
      const res = await saveSection({
        id: section?.id,
        title: title.trim(),
        description: description.trim(),
        visibleToRoles: roles,
        status,
      });
      if (res.ok) {
        toast.success(section ? "Section updated." : "Section created.");
        router.refresh();
        onOpenChange(false);
      } else {
        setErrors({ title: res.error });
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{section ? "Edit section" : "Add section"}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 px-4">
          <div>
            <Label htmlFor="sec-title">Title</Label>
            <Input
              id="sec-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Company Onboarding"
            />
            {errors.title && (
              <p className="text-destructive mt-1 text-xs">{errors.title}</p>
            )}
          </div>
          <div>
            <Label htmlFor="sec-desc">Description (optional)</Label>
            <Textarea
              id="sec-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <RoleMultiSelect value={roles} onChange={setRoles} />
          <div>
            <Label htmlFor="sec-status">Status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as PublishStatus)}
            >
              <SelectTrigger id="sec-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
