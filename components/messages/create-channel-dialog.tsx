"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Globe, Loader2, Lock, X } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils/index";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/shared/user-avatar";
import { ROLE_LABELS } from "@/lib/constants/roles";
import { createChannel } from "@/app/app/messages/actions";
import {
  MAX_CHANNEL_DESCRIPTION_CHARS,
  slugifyChannelName,
} from "@/lib/messages/constants";
import type { ChannelVisibility, MemberLite } from "@/lib/messages/types";

export function CreateChannelDialog({
  members,
  open,
  onOpenChange,
}: {
  members: MemberLite[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [visibility, setVisibility] =
    React.useState<ChannelVisibility>("public");
  const [selected, setSelected] = React.useState<MemberLite[]>([]);
  const [query, setQuery] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const slug = slugifyChannelName(name);

  const reset = () => {
    setName("");
    setDescription("");
    setVisibility("public");
    setSelected([]);
    setQuery("");
  };

  const matches = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const chosen = new Set(selected.map((s) => s.id));
    return members
      .filter((m) => !chosen.has(m.id))
      .filter((m) => !q || (m.name ?? "").toLowerCase().includes(q))
      .slice(0, 6);
  }, [members, query, selected]);

  const submit = async () => {
    if (!slug) {
      toast.error("Give your channel a name.");
      return;
    }
    setSubmitting(true);
    const res = await createChannel({
      name: slug,
      description: description.trim(),
      visibility,
      memberIds: selected.map((s) => s.id),
    });
    setSubmitting(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    onOpenChange(false);
    reset();
    router.push(`/app/messages/channels/${res.channelId}`);
    router.refresh();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a channel</DialogTitle>
          <DialogDescription>
            Channels are shared spaces for your team to talk about a topic.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1">
          <label className="text-sm font-medium">Name</label>
          <div className="border-input focus-within:ring-ring flex items-center rounded-md border bg-transparent px-3 focus-within:ring-2">
            <span className="text-muted-foreground text-sm">#</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              maxLength={80}
              placeholder="ops-handoff"
              className="h-9 flex-1 bg-transparent px-1 text-sm focus:outline-none"
            />
          </div>
          <p className="text-muted-foreground text-xs">
            {slug ? (
              <>
                Your channel:{" "}
                <span className="text-foreground font-medium">#{slug}</span>
              </>
            ) : (
              "Lowercase letters, numbers, and hyphens only."
            )}
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Description</label>
          <textarea
            value={description}
            onChange={(e) =>
              setDescription(
                e.target.value.slice(0, MAX_CHANNEL_DESCRIPTION_CHARS),
              )
            }
            rows={2}
            placeholder="What is this channel about? (Optional)"
            className="border-input focus-visible:ring-ring w-full resize-none rounded-md border bg-transparent px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Visibility</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              {
                v: "public" as const,
                icon: Globe,
                title: "Public",
                sub: "Anyone on your team can find and join",
              },
              {
                v: "private" as const,
                icon: Lock,
                title: "Private",
                sub: "Only invited people can see this channel",
              },
            ].map(({ v, icon: Icon, title, sub }) => (
              <button
                key={v}
                type="button"
                onClick={() => setVisibility(v)}
                className={cn(
                  "rounded-md border p-2.5 text-left transition",
                  visibility === v
                    ? "border-primary bg-primary/5 ring-primary/30 ring-1"
                    : "hover:bg-muted/50",
                )}
              >
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <Icon className="size-3.5" /> {title}
                </span>
                <span className="text-muted-foreground mt-0.5 block text-xs">
                  {sub}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">
            Add members{" "}
            <span className="text-muted-foreground font-normal">
              (optional)
            </span>
          </label>
          {selected.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {selected.map((m) => (
                <span
                  key={m.id}
                  className="bg-muted flex items-center gap-1.5 rounded-full py-0.5 pr-1.5 pl-1 text-sm"
                >
                  <UserAvatar
                    name={m.name}
                    src={m.avatarUrl}
                    seed={m.id}
                    size="sm"
                  />
                  {m.name}
                  <button
                    type="button"
                    aria-label={`Remove ${m.name}`}
                    onClick={() =>
                      setSelected((prev) => prev.filter((s) => s.id !== m.id))
                    }
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search teammates"
            className="border-input focus-visible:ring-ring h-9 w-full rounded-md border bg-transparent px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
          />
          {query.trim() && matches.length > 0 ? (
            <div className="max-h-40 overflow-y-auto rounded-md border">
              {matches.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setSelected((prev) => [...prev, m]);
                    setQuery("");
                  }}
                  className="hover:bg-accent flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
                >
                  <UserAvatar
                    name={m.name}
                    src={m.avatarUrl}
                    seed={m.id}
                    size="sm"
                  />
                  <span className="min-w-0 flex-1 truncate">{m.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {ROLE_LABELS[m.role]}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button onClick={() => void submit()} disabled={submitting || !slug}>
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "Create channel"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
