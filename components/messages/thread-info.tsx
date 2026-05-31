"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Download,
  FileText,
  LogOut,
  Pencil,
  Pin,
  Plus,
  UserMinus,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { UserAvatar } from "@/components/shared/user-avatar";
import { formatBytes, formatDate } from "@/lib/utils/format";
import { ROLE_LABELS } from "@/lib/constants/roles";
import { isImageType } from "@/lib/messages/constants";
import {
  addParticipants,
  removeParticipant,
  renameThread,
} from "@/app/app/messages/actions";
import type { MemberLite, ThreadDetail } from "@/lib/messages/types";

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2 border-b px-4 py-3">
      <div className="flex items-center justify-between">
        <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </div>
  );
}

export function ThreadInfo({
  thread,
  members,
  currentUserId,
  onClose,
}: {
  thread: ThreadDetail;
  members: MemberLite[];
  currentUserId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const isGroup = thread.type === "group";
  const isOwner = thread.createdBy === currentUserId;
  const participantIds = new Set(thread.participants.map((p) => p.id));

  const [editingName, setEditingName] = React.useState(false);
  const [name, setName] = React.useState(thread.customName ?? "");
  const [adding, setAdding] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const saveName = async () => {
    const res = await renameThread({ threadId: thread.id, name: name.trim() });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setEditingName(false);
    router.refresh();
  };

  const add = async (m: MemberLite) => {
    const res = await addParticipants({
      threadId: thread.id,
      userIds: [m.id],
    });
    if (!res.ok) toast.error(res.error);
    else {
      toast.success(`Added ${m.name ?? "member"}.`);
      router.refresh();
    }
  };

  const remove = async (userId: string, isSelf: boolean) => {
    if (isSelf && !confirm("Leave this group?")) return;
    const res = await removeParticipant({ threadId: thread.id, userId });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    if (isSelf) router.push("/app/messages");
    router.refresh();
  };

  const candidates = members
    .filter((m) => !participantIds.has(m.id))
    .filter(
      (m) =>
        !query.trim() ||
        (m.name ?? "").toLowerCase().includes(query.toLowerCase()),
    )
    .slice(0, 6);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
        <h2 className="text-sm font-semibold">Details</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="hover:bg-accent text-muted-foreground rounded-md p-1.5"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Group name */}
        {isGroup ? (
          <Section
            title="Name"
            action={
              !editingName ? (
                <button
                  type="button"
                  onClick={() => {
                    setName(thread.customName ?? "");
                    setEditingName(true);
                  }}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Edit name"
                >
                  <Pencil className="size-3.5" />
                </button>
              ) : null
            }
          >
            {editingName ? (
              <div className="flex items-center gap-1.5">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={thread.name}
                  className="border-input focus-visible:ring-ring h-8 flex-1 rounded-md border bg-transparent px-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
                />
                <button
                  type="button"
                  onClick={() => void saveName()}
                  aria-label="Save name"
                  className="text-primary p-1"
                >
                  <Check className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingName(false)}
                  aria-label="Cancel"
                  className="text-muted-foreground p-1"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <p className="text-sm">{thread.name}</p>
            )}
          </Section>
        ) : null}

        {/* Participants */}
        <Section
          title={`Participants (${thread.participants.length})`}
          action={
            isGroup ? (
              <button
                type="button"
                onClick={() => setAdding((v) => !v)}
                className="text-primary flex items-center gap-1 text-xs font-medium"
              >
                <Plus className="size-3.5" /> Add
              </button>
            ) : null
          }
        >
          {adding ? (
            <div className="mb-2 space-y-1.5">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search teammates"
                className="border-input focus-visible:ring-ring h-8 w-full rounded-md border bg-transparent px-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
              />
              <div className="overflow-hidden rounded-md border">
                {candidates.length === 0 ? (
                  <p className="text-muted-foreground px-2 py-2 text-xs">
                    No one to add.
                  </p>
                ) : (
                  candidates.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => void add(m)}
                      className="hover:bg-accent flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm"
                    >
                      <UserAvatar
                        name={m.name}
                        src={m.avatarUrl}
                        seed={m.id}
                        size="sm"
                      />
                      <span className="min-w-0 flex-1 truncate">{m.name}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : null}

          <ul className="space-y-1">
            {thread.participants.map((p) => {
              const isSelf = p.id === currentUserId;
              const canRemove = isGroup && (isSelf || isOwner);
              return (
                <li key={p.id} className="flex items-center gap-2">
                  <UserAvatar
                    name={p.name}
                    src={p.avatarUrl}
                    seed={p.id}
                    size="sm"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {p.name}
                    {isSelf ? " (you)" : ""}
                  </span>
                  <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px] font-medium">
                    {ROLE_LABELS[p.role]}
                  </span>
                  {canRemove ? (
                    <button
                      type="button"
                      onClick={() => void remove(p.id, isSelf)}
                      aria-label={isSelf ? "Leave group" : `Remove ${p.name}`}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      {isSelf ? (
                        <LogOut className="size-3.5" />
                      ) : (
                        <UserMinus className="size-3.5" />
                      )}
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Section>

        {/* Files */}
        <Section title={`Files (${thread.files.length})`}>
          {thread.files.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No files shared yet.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {thread.files.map((f) => (
                <li key={f.path}>
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={f.name}
                    className="hover:bg-muted/50 flex items-center gap-2 rounded-md p-1.5 text-sm"
                  >
                    {isImageType(f.contentType) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={f.url}
                        alt={f.name}
                        className="size-8 shrink-0 rounded object-cover"
                      />
                    ) : (
                      <span className="bg-muted flex size-8 shrink-0 items-center justify-center rounded">
                        <FileText className="text-muted-foreground size-4" />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{f.name}</span>
                      <span className="text-muted-foreground text-xs">
                        {f.size != null ? `${formatBytes(f.size)} · ` : ""}
                        {formatDate(f.uploadedAt, "short")}
                      </span>
                    </span>
                    <Download className="text-muted-foreground size-4 shrink-0" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Pinned (stub) */}
        <Section title="Pinned">
          <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <Pin className="size-3.5" /> Pinning messages is coming soon.
          </p>
        </Section>
      </div>
    </div>
  );
}
