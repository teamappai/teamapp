"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Globe, Loader2, Lock } from "lucide-react";
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
import { updateChannel } from "@/app/app/messages/actions";
import {
  MAX_CHANNEL_DESCRIPTION_CHARS,
  slugifyChannelName,
} from "@/lib/messages/constants";
import type { ChannelVisibility, ThreadDetail } from "@/lib/messages/types";

export function EditChannelDialog({
  channel,
  open,
  onOpenChange,
}: {
  channel: ThreadDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [name, setName] = React.useState(channel.customName ?? "");
  const [description, setDescription] = React.useState(
    channel.description ?? "",
  );
  const [visibility, setVisibility] = React.useState<ChannelVisibility>(
    channel.visibility ?? "public",
  );
  const [submitting, setSubmitting] = React.useState(false);

  // Reset local state whenever a fresh channel is opened.
  React.useEffect(() => {
    if (open) {
      setName(channel.customName ?? "");
      setDescription(channel.description ?? "");
      setVisibility(channel.visibility ?? "public");
    }
  }, [open, channel.customName, channel.description, channel.visibility]);

  const slug = slugifyChannelName(name);

  const submit = async () => {
    setSubmitting(true);
    const res = await updateChannel({
      channelId: channel.id,
      name: channel.isGeneral ? undefined : slug,
      description: description.trim(),
      visibility: channel.isGeneral ? undefined : visibility,
    });
    setSubmitting(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Channel updated.");
    onOpenChange(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit channel</DialogTitle>
          <DialogDescription>
            Update the name, description, or visibility.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1">
          <label className="text-sm font-medium">Name</label>
          <div
            className={cn(
              "border-input flex items-center rounded-md border bg-transparent px-3",
              channel.isGeneral && "opacity-60",
            )}
          >
            <span className="text-muted-foreground text-sm">#</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={channel.isGeneral}
              maxLength={80}
              className="h-9 flex-1 bg-transparent px-1 text-sm focus:outline-none disabled:cursor-not-allowed"
            />
          </div>
          {channel.isGeneral ? (
            <p className="text-muted-foreground text-xs">
              #general can&rsquo;t be renamed.
            </p>
          ) : slug ? (
            <p className="text-muted-foreground text-xs">
              Your channel:{" "}
              <span className="text-foreground font-medium">#{slug}</span>
            </p>
          ) : null}
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
              { v: "public" as const, icon: Globe, title: "Public" },
              { v: "private" as const, icon: Lock, title: "Private" },
            ].map(({ v, icon: Icon, title }) => {
              const disabled = channel.isGeneral && v === "private";
              return (
                <button
                  key={v}
                  type="button"
                  disabled={disabled}
                  onClick={() => setVisibility(v)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md border p-2.5 text-sm font-medium transition",
                    visibility === v
                      ? "border-primary bg-primary/5 ring-primary/30 ring-1"
                      : "hover:bg-muted/50",
                    disabled && "cursor-not-allowed opacity-50",
                  )}
                >
                  <Icon className="size-3.5" /> {title}
                </button>
              );
            })}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => void submit()} disabled={submitting}>
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "Save changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
