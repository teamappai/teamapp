"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  PLAYBOOK_CATEGORIES,
  PLAYBOOK_ICONS,
  PLAYBOOK_GRADIENTS,
  DEFAULT_PLAYBOOK_GRADIENT,
} from "@/lib/constants/playbooks";
import { slugify } from "@/lib/validations/playbook";
import {
  createPlaybookAction,
  updatePlaybookMetadataAction,
} from "@/app/app/admin/playbooks/actions";
import {
  PLAYBOOK_ICON_MAP,
  resolvePlaybookIcon,
} from "@/components/playbooks/playbook-icon";
import { PlaybookCover } from "@/components/playbooks/playbook-cover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils/index";

const CUSTOM_CATEGORY = "__custom__";

export type PlaybookFormValues = {
  id?: string;
  title: string;
  slug: string;
  description: string;
  category: string;
  iconName: string;
  coverGradient: string;
  creditText: string;
  recommendedForOnboarding: boolean;
};

export function PlaybookForm({
  mode,
  initial,
}: {
  mode: "create" | "edit";
  initial?: PlaybookFormValues;
}) {
  const router = useRouter();
  const [title, setTitle] = React.useState(initial?.title ?? "");
  const [slug, setSlug] = React.useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = React.useState(mode === "edit");
  const [description, setDescription] = React.useState(
    initial?.description ?? "",
  );
  const isPresetCategory =
    !initial?.category ||
    (PLAYBOOK_CATEGORIES as readonly string[]).includes(initial.category);
  const [categoryChoice, setCategoryChoice] = React.useState(
    initial?.category && !isPresetCategory
      ? CUSTOM_CATEGORY
      : (initial?.category ?? PLAYBOOK_CATEGORIES[0]),
  );
  const [customCategory, setCustomCategory] = React.useState(
    initial?.category && !isPresetCategory ? initial.category : "",
  );
  const [iconName, setIconName] = React.useState(
    initial?.iconName || PLAYBOOK_ICONS[0],
  );
  const [gradient, setGradient] = React.useState(
    initial?.coverGradient || DEFAULT_PLAYBOOK_GRADIENT,
  );
  const [creditText, setCreditText] = React.useState(initial?.creditText ?? "");
  const [recommended, setRecommended] = React.useState(
    initial?.recommendedForOnboarding ?? false,
  );
  const [error, setError] = React.useState<string>();
  const [pending, start] = React.useTransition();

  const effectiveSlug = slugTouched ? slug : slugify(title);
  const category =
    categoryChoice === CUSTOM_CATEGORY ? customCategory.trim() : categoryChoice;

  function submit() {
    setError(undefined);
    if (!title.trim()) return setError("Title is required.");
    if (!category) return setError("Category is required.");
    const values = {
      title: title.trim(),
      slug: effectiveSlug,
      description: description.trim(),
      category,
      iconName,
      coverGradient: gradient,
      creditText: creditText.trim(),
      recommendedForOnboarding: recommended,
    };
    start(async () => {
      const res =
        mode === "create"
          ? await createPlaybookAction(values)
          : await updatePlaybookMetadataAction(initial!.id!, values);
      if (res.ok) {
        if (mode === "create" && "id" in res) {
          toast.success("Playbook created.");
          router.push(`/app/admin/playbooks/${res.id}`);
        } else {
          toast.success("Playbook saved.");
          router.refresh();
        }
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_240px]">
      <div className="space-y-4">
        <div>
          <Label htmlFor="pb-title">Title</Label>
          <Input
            id="pb-title"
            value={title}
            maxLength={100}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="New Agent 30-Day Onboarding"
          />
        </div>

        <div>
          <Label htmlFor="pb-slug">Slug</Label>
          <Input
            id="pb-slug"
            value={effectiveSlug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugify(e.target.value));
            }}
            placeholder="new-agent-30-day-onboarding"
          />
          <p className="text-muted-foreground mt-1 text-xs">
            Used in the playbook URL. Auto-generated from the title.
          </p>
        </div>

        <div>
          <Label htmlFor="pb-desc">Description</Label>
          <Textarea
            id="pb-desc"
            value={description}
            maxLength={500}
            rows={3}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What this playbook covers and who it's for."
          />
        </div>

        <div>
          <Label htmlFor="pb-category">Category</Label>
          <Select value={categoryChoice} onValueChange={setCategoryChoice}>
            <SelectTrigger id="pb-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLAYBOOK_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
              <SelectItem value={CUSTOM_CATEGORY}>Custom…</SelectItem>
            </SelectContent>
          </Select>
          {categoryChoice === CUSTOM_CATEGORY && (
            <Input
              className="mt-2"
              value={customCategory}
              maxLength={80}
              onChange={(e) => setCustomCategory(e.target.value)}
              placeholder="New category name"
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Icon</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  {React.createElement(resolvePlaybookIcon(iconName), {
                    className: "size-4",
                  })}
                  {iconName}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="grid w-64 grid-cols-6 gap-1 p-2">
                {PLAYBOOK_ICONS.map((name) => {
                  const Icon = PLAYBOOK_ICON_MAP[name]!;
                  return (
                    <button
                      key={name}
                      type="button"
                      title={name}
                      onClick={() => setIconName(name)}
                      className={cn(
                        "hover:bg-accent flex size-9 items-center justify-center rounded-md",
                        iconName === name && "bg-accent ring-primary ring-2",
                      )}
                    >
                      <Icon className="size-4" />
                    </button>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div>
            <Label htmlFor="pb-gradient">Cover gradient</Label>
            <Select value={gradient} onValueChange={setGradient}>
              <SelectTrigger id="pb-gradient">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLAYBOOK_GRADIENTS.map((g) => (
                  <SelectItem key={g.value} value={g.value}>
                    <span
                      className={cn(
                        "mr-2 inline-block size-3 rounded-full bg-gradient-to-br",
                        g.value,
                      )}
                    />
                    {g.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="pb-credit">Creator credit (optional)</Label>
          <Input
            id="pb-credit"
            value={creditText}
            maxLength={200}
            onChange={(e) => setCreditText(e.target.value)}
            placeholder="Created by Sarah Chen, Chen Luxury Group"
          />
        </div>

        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <Label htmlFor="pb-recommended">Recommended for onboarding</Label>
            <p className="text-muted-foreground text-xs">
              Surface this playbook in the new-team setup step.
            </p>
          </div>
          <Switch
            id="pb-recommended"
            checked={recommended}
            onCheckedChange={setRecommended}
          />
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <Button onClick={submit} disabled={pending}>
          {pending
            ? "Saving…"
            : mode === "create"
              ? "Create playbook"
              : "Save metadata"}
        </Button>
      </div>

      <div className="space-y-2">
        <Label>Preview</Label>
        <PlaybookCover iconName={iconName} gradient={gradient} size="md" />
        <p className="text-sm font-medium">{title || "Playbook title"}</p>
        {category && (
          <p className="text-muted-foreground text-xs">{category}</p>
        )}
      </div>
    </div>
  );
}
