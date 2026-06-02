"use client";

import * as React from "react";
import { AtSign, Loader2, Paperclip, SendHorizonal, X } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils/index";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/shared/user-avatar";
import { createClient } from "@/lib/supabase/client";
import { uploadMessageAttachment } from "@/lib/storage";
import {
  MAX_MESSAGE_FILE_MB,
  MESSAGE_FILE_ACCEPT,
  isImageType,
} from "@/lib/messages/constants";
import type { MemberLite, SignedAttachment } from "@/lib/messages/types";
import { ROLE_LABELS } from "@/lib/constants/roles";

type PendingFile = {
  path: string;
  name: string;
  size: number | null;
  contentType: string | null;
  /** Object URL for instant image preview before the server signs it. */
  localUrl: string;
};

export type ComposerSubmit = {
  body: string;
  attachments: Array<{
    path: string;
    name: string;
    size: number | null;
    contentType: string | null;
  }>;
  /** Local previews for the optimistic message bubble. */
  previews: SignedAttachment[];
};

/** A tracked mention inserted via the popover: `@token` → user id (or "channel"). */
type Mention = { token: string; id: string };

/** A row in the mention popover: a teammate, or the special @channel option. */
type PopoverItem = { kind: "channel" } | { kind: "member"; member: MemberLite };

const CHANNEL_TOKEN = "@channel";
const CHANNEL_MENTION_ID = "channel";

const MENTION_QUERY_RE = /(?:^|\s)@(\w*)$/;

export function Composer({
  threadId,
  companyId,
  members,
  allowChannelMention,
  replyingTo,
  onCancelReply,
  onSubmit,
}: {
  threadId: string;
  companyId: string;
  /** Company members for the mention popover. */
  members: MemberLite[];
  /** Whether @channel is offered (channels only — Decision 9). */
  allowChannelMention: boolean;
  replyingTo: { id: string; snippet: string; author: string | null } | null;
  onCancelReply: () => void;
  onSubmit: (payload: ComposerSubmit) => Promise<void>;
}) {
  const supabase = React.useMemo(() => createClient(), []);
  const [text, setText] = React.useState("");
  const [mentions, setMentions] = React.useState<Mention[]>([]);
  const [files, setFiles] = React.useState<PendingFile[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [query, setQuery] = React.useState<string | null>(null);
  const [activeIdx, setActiveIdx] = React.useState(0);

  const taRef = React.useRef<HTMLTextAreaElement>(null);
  const backdropRef = React.useRef<HTMLDivElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  // Auto-grow the textarea up to ~5 lines, then scroll.
  React.useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 132)}px`;
  }, [text]);

  const items = React.useMemo((): PopoverItem[] => {
    if (query == null) return [];
    const q = query.toLowerCase();
    const memberItems: PopoverItem[] = members
      .filter((m) => (m.name ?? "").toLowerCase().includes(q))
      .slice(0, 6)
      .map((member) => ({ kind: "member", member }));
    const channelItems: PopoverItem[] =
      allowChannelMention && "channel".startsWith(q)
        ? [{ kind: "channel" }]
        : [];
    return [...channelItems, ...memberItems];
  }, [query, members, allowChannelMention]);

  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setText(value);
    const before = value.slice(0, e.target.selectionStart ?? value.length);
    const m = MENTION_QUERY_RE.exec(before);
    if (m) {
      setQuery(m[1] ?? "");
      setActiveIdx(0);
    } else {
      setQuery(null);
    }
    // Drop mentions whose token text no longer appears.
    setMentions((prev) => prev.filter((mn) => value.includes(mn.token)));
  };

  const insertToken = (token: string, id: string) => {
    const ta = taRef.current;
    const caret = ta?.selectionStart ?? text.length;
    const before = text.slice(0, caret).replace(MENTION_QUERY_RE, (full) => {
      // Preserve a leading space/newline captured by the regex.
      const lead = /^\s/.test(full) ? full[0] : "";
      return `${lead}${token} `;
    });
    const after = text.slice(caret);
    const next = before + after;
    setText(next);
    setMentions((prev) =>
      prev.some((mn) => mn.id === id && mn.token === token)
        ? prev
        : [...prev, { token, id }],
    );
    setQuery(null);
    requestAnimationFrame(() => {
      ta?.focus();
      const pos = before.length;
      ta?.setSelectionRange(pos, pos);
    });
  };

  const insertItem = (item: PopoverItem) => {
    if (item.kind === "channel") {
      insertToken(CHANNEL_TOKEN, CHANNEL_MENTION_ID);
    } else {
      insertToken(`@${item.member.name ?? "someone"}`, item.member.id);
    }
  };

  /** Replace tracked `@token` substrings with `<@id>` markers for storage. */
  const serialize = (raw: string): string => {
    let out = raw;
    // Longest tokens first so "@Phil" doesn't clobber "@Phil Kang".
    for (const mn of [...mentions].sort(
      (a, b) => b.token.length - a.token.length,
    )) {
      out = out.split(mn.token).join(`<@${mn.id}>`);
    }
    return out;
  };

  const onPickFiles = async (list: FileList) => {
    const arr = Array.from(list);
    const tooBig = arr.find((f) => f.size > MAX_MESSAGE_FILE_MB * 1024 * 1024);
    if (tooBig) {
      toast.error(`Each file must be under ${MAX_MESSAGE_FILE_MB}MB.`);
      return;
    }
    setUploading(true);
    try {
      for (const file of arr) {
        const { path } = await uploadMessageAttachment(supabase, {
          companyId,
          threadId,
          filename: file.name,
          file,
        });
        setFiles((prev) => [
          ...prev,
          {
            path,
            name: file.name,
            size: file.size,
            contentType: file.type || null,
            localUrl: URL.createObjectURL(file),
          },
        ]);
      }
    } catch (err) {
      console.error(err);
      toast.error("Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const canSend = (text.trim().length > 0 || files.length > 0) && !sending;

  const submit = async () => {
    if (!canSend) return;
    setSending(true);
    const body = serialize(text);
    const payload: ComposerSubmit = {
      body,
      attachments: files.map((f) => ({
        path: f.path,
        name: f.name,
        size: f.size,
        contentType: f.contentType,
      })),
      previews: files.map((f) => ({
        path: f.path,
        name: f.name,
        size: f.size,
        contentType: f.contentType,
        url: f.localUrl,
      })),
    };
    // Optimistically clear the composer.
    setText("");
    setMentions([]);
    setFiles([]);
    setQuery(null);
    try {
      await onSubmit(payload);
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (query != null && items.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => (i + 1) % items.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => (i - 1 + items.length) % items.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertItem(items[activeIdx]!);
        return;
      }
      if (e.key === "Escape") {
        setQuery(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  // Highlight tracked mention tokens in the backdrop layer.
  const highlighted = React.useMemo(() => {
    const tokens = [...mentions]
      .map((m) => m.token)
      .sort((a, b) => b.length - a.length);
    if (tokens.length === 0) return [text + "\n"];
    const escaped = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const re = new RegExp(`(${escaped.join("|")})`, "g");
    return (text + "\n").split(re).map((part, i) =>
      tokens.includes(part) ? (
        <span
          key={i}
          className="bg-primary/10 text-primary rounded font-medium"
        >
          {part}
        </span>
      ) : (
        <React.Fragment key={i}>{part}</React.Fragment>
      ),
    );
  }, [text, mentions]);

  return (
    <div className="border-t px-3 py-2.5 sm:px-4">
      {replyingTo ? (
        <div className="bg-muted/40 text-muted-foreground mb-2 flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs">
          <span className="min-w-0 flex-1 truncate">
            Replying to{" "}
            <span className="font-medium">
              {replyingTo.author ?? "message"}
            </span>
            : {replyingTo.snippet}
          </span>
          <button
            type="button"
            onClick={onCancelReply}
            className="hover:text-foreground shrink-0"
            aria-label="Cancel reply"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : null}

      {files.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-2">
          {files.map((f, i) => (
            <span
              key={f.path}
              className="bg-muted/50 flex items-center gap-1.5 rounded border px-2 py-1 text-xs"
            >
              {isImageType(f.contentType) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={f.localUrl}
                  alt={f.name}
                  className="size-5 rounded object-cover"
                />
              ) : (
                <Paperclip className="size-3.5" />
              )}
              <span className="max-w-[10rem] truncate">{f.name}</span>
              <button
                type="button"
                aria-label={`Remove ${f.name}`}
                onClick={() =>
                  setFiles((prev) => prev.filter((_, j) => j !== i))
                }
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          aria-label="Attach files"
          className="text-muted-foreground hover:bg-accent hover:text-foreground flex size-9 shrink-0 items-center justify-center rounded-md transition disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <Paperclip className="size-5" />
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept={MESSAGE_FILE_ACCEPT}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void onPickFiles(e.target.files);
            e.target.value = "";
          }}
        />

        <div className="relative flex-1">
          {/* Mention popover */}
          {query != null && items.length > 0 ? (
            <div className="bg-popover absolute bottom-full left-0 z-20 mb-1 w-64 overflow-hidden rounded-md border shadow-md">
              {items.map((item, i) =>
                item.kind === "channel" ? (
                  <button
                    key="channel"
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      insertItem(item);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm",
                      i === activeIdx ? "bg-accent" : "hover:bg-accent",
                    )}
                  >
                    <span className="flex size-6 shrink-0 items-center justify-center rounded bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                      <AtSign className="size-3.5" />
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">
                      @channel
                    </span>
                    <span className="text-muted-foreground text-xs">
                      Notify everyone
                    </span>
                  </button>
                ) : (
                  <button
                    key={item.member.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      insertItem(item);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm",
                      i === activeIdx ? "bg-accent" : "hover:bg-accent",
                    )}
                  >
                    <UserAvatar
                      name={item.member.name}
                      src={item.member.avatarUrl}
                      seed={item.member.id}
                      size="sm"
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {item.member.name}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {ROLE_LABELS[item.member.role]}
                    </span>
                  </button>
                ),
              )}
            </div>
          ) : null}

          {/* Highlight backdrop (mirrors the textarea) */}
          <div
            ref={backdropRef}
            aria-hidden
            className="pointer-events-none absolute inset-0 max-h-[132px] overflow-hidden px-3 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap"
          >
            {highlighted}
          </div>

          <textarea
            ref={taRef}
            value={text}
            onChange={onChange}
            onKeyDown={onKeyDown}
            onScroll={() => {
              if (backdropRef.current && taRef.current) {
                backdropRef.current.scrollTop = taRef.current.scrollTop;
              }
            }}
            rows={1}
            placeholder="Write a message…  (@ to mention, Enter to send)"
            className={cn(
              "border-input focus-visible:ring-ring caret-foreground relative max-h-[132px] w-full resize-none rounded-md border bg-transparent px-3 py-2 text-sm leading-relaxed break-words text-transparent focus-visible:ring-2 focus-visible:outline-none",
            )}
          />
        </div>

        <Button
          type="button"
          size="icon"
          onClick={() => void submit()}
          disabled={!canSend}
          aria-label="Send message"
          className="size-9 shrink-0"
        >
          {sending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <SendHorizonal className="size-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
