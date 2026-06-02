"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Globe,
  Hash,
  Loader2,
  Lock,
  Plus,
  Search,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils/index";
import { formatDate } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { CreateChannelDialog } from "@/components/messages/create-channel-dialog";
import { joinChannel, leaveChannel } from "@/app/app/messages/actions";
import type { ChannelSummary, MemberLite } from "@/lib/messages/types";

type Filter = "all" | "joined" | "public" | "private";

export function ChannelBrowser({
  channels,
  members,
  canManageChannels,
  autoOpenCreate,
}: {
  channels: ChannelSummary[];
  members: MemberLite[];
  canManageChannels: boolean;
  autoOpenCreate: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("all");
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(autoOpenCreate);

  const hasPrivate = channels.some((c) => c.visibility === "private");

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return channels.filter((c) => {
      if (filter === "joined" && !c.isMember) return false;
      if (filter === "public" && c.visibility !== "public") return false;
      if (filter === "private" && c.visibility !== "private") return false;
      if (!q) return true;
      return [c.name, c.description ?? ""].join(" ").toLowerCase().includes(q);
    });
  }, [channels, filter, search]);

  const join = async (c: ChannelSummary) => {
    setBusyId(c.id);
    const res = await joinChannel({ channelId: c.id });
    setBusyId(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    router.push(`/app/messages/channels/${c.id}`);
    router.refresh();
  };

  const leave = async (c: ChannelSummary) => {
    setBusyId(c.id);
    const res = await leaveChannel({ channelId: c.id });
    setBusyId(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Left #${c.name}.`);
    router.refresh();
  };

  const FILTERS: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "joined", label: "Joined" },
    { id: "public", label: "Public" },
    ...(hasPrivate ? [{ id: "private" as const, label: "Private" }] : []),
  ];

  return (
    <div className="mx-auto h-full w-full max-w-3xl overflow-y-auto px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={() => router.push("/app/messages")}
            className="text-muted-foreground hover:text-foreground mb-1 flex items-center gap-1 text-xs"
          >
            <ArrowLeft className="size-3.5" /> Back to messages
          </button>
          <h1 className="text-xl font-semibold">Channels</h1>
          <p className="text-muted-foreground text-sm">
            Browse and join your team&rsquo;s channels
          </p>
        </div>
        {canManageChannels ? (
          <Button onClick={() => setCreateOpen(true)} className="shrink-0">
            <Plus className="size-4" /> Create channel
          </Button>
        ) : null}
      </div>

      <div className="relative mb-3">
        <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search channels"
          className="border-input focus-visible:ring-ring h-9 w-full rounded-md border bg-transparent pr-2 pl-8 text-sm focus-visible:ring-2 focus-visible:outline-none"
        />
      </div>

      <div className="mb-4 flex gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition",
              filter === f.id
                ? "border-primary bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted/50",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed px-6 py-12 text-center">
          <p className="text-sm font-medium">No channels yet</p>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {canManageChannels
              ? "Create the first one for your team."
              : "Check back once your team sets some up."}
          </p>
          {canManageChannels ? (
            <Button
              variant="outline"
              className="mt-3"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="size-4" /> Create channel
            </Button>
          ) : null}
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((c) => (
            <li
              key={c.id}
              className="hover:bg-muted/30 flex items-start gap-3 rounded-lg border p-3 transition-colors"
            >
              <span className="bg-muted text-muted-foreground mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md">
                {c.visibility === "private" ? (
                  <Lock className="size-4" />
                ) : (
                  <Hash className="size-4" />
                )}
              </span>
              <button
                type="button"
                onClick={() =>
                  c.isMember
                    ? router.push(`/app/messages/channels/${c.id}`)
                    : void join(c)
                }
                className="min-w-0 flex-1 text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold">
                    {c.name}
                  </span>
                  <span className="text-muted-foreground inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[10px] font-medium">
                    {c.visibility === "private" ? (
                      <>
                        <Lock className="size-2.5" /> Private
                      </>
                    ) : (
                      <>
                        <Globe className="size-2.5" /> Public
                      </>
                    )}
                  </span>
                </div>
                <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
                  {c.description || "No description yet"}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {c.memberCount} member{c.memberCount === 1 ? "" : "s"} ·{" "}
                  {formatDate(c.lastActivityAt, "short")}
                </p>
              </button>
              <div className="shrink-0 self-center">
                {c.isMember ? (
                  c.isGeneral ? (
                    <span className="text-muted-foreground rounded-md border px-2.5 py-1 text-xs font-medium">
                      Joined
                    </span>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busyId === c.id}
                      onClick={() => void leave(c)}
                    >
                      {busyId === c.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        "Leave"
                      )}
                    </Button>
                  )
                ) : (
                  <Button
                    size="sm"
                    disabled={busyId === c.id}
                    onClick={() => void join(c)}
                  >
                    {busyId === c.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      "Join"
                    )}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canManageChannels ? (
        <CreateChannelDialog
          members={members}
          open={createOpen}
          onOpenChange={setCreateOpen}
        />
      ) : null}
    </div>
  );
}
