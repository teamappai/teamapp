"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/shared/user-avatar";
import { ROLE_LABELS } from "@/lib/constants/roles";
import { createThreadAndSend } from "@/app/app/messages/actions";
import { autoGroupName } from "@/lib/messages/constants";
import type { MemberLite } from "@/lib/messages/types";

export function NewMessageDialog({
  members,
  trigger,
  open: openProp,
  onOpenChange,
}: {
  members: MemberLite[];
  trigger?: React.ReactNode;
  /** Controlled open (when driven by the "+ New" menu). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const [openState, setOpenState] = React.useState(false);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : openState;
  const setOpen = (o: boolean) => {
    if (controlled) onOpenChange?.(o);
    else setOpenState(o);
  };
  const [selected, setSelected] = React.useState<MemberLite[]>([]);
  const [query, setQuery] = React.useState("");
  const [body, setBody] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const reset = () => {
    setSelected([]);
    setQuery("");
    setBody("");
  };

  const matches = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const chosen = new Set(selected.map((s) => s.id));
    return members
      .filter((m) => !chosen.has(m.id))
      .filter((m) => !q || (m.name ?? "").toLowerCase().includes(q))
      .slice(0, 8);
  }, [members, query, selected]);

  const create = async () => {
    if (selected.length === 0) {
      toast.error("Pick at least one person.");
      return;
    }
    setSubmitting(true);
    const res = await createThreadAndSend({
      participantIds: selected.map((s) => s.id),
      name: "",
      body: body.trim(),
    });
    setSubmitting(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setOpen(false);
    reset();
    router.push(`/app/messages/${res.threadId}`);
    router.refresh();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New message</DialogTitle>
          <DialogDescription>
            {selected.length > 1
              ? `Group: ${autoGroupName(selected.map((s) => s.name))}`
              : "Choose a teammate, or add more for a group."}
          </DialogDescription>
        </DialogHeader>

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

        <div className="max-h-56 overflow-y-auto rounded-md border">
          {matches.length === 0 ? (
            <p className="text-muted-foreground px-3 py-4 text-center text-sm">
              No teammates found.
            </p>
          ) : (
            matches.map((m) => (
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
            ))
          )}
        </div>

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder="Optional message…"
          className="border-input focus-visible:ring-ring w-full resize-none rounded-md border bg-transparent px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
        />

        <DialogFooter>
          <Button onClick={() => void create()} disabled={submitting}>
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : selected.length > 1 ? (
              "Create group"
            ) : (
              "Start conversation"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
