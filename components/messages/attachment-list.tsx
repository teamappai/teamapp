"use client";

import * as React from "react";
import { Download, FileText } from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { formatBytes } from "@/lib/utils/format";
import { isImageType } from "@/lib/messages/constants";
import type { SignedAttachment } from "@/lib/messages/types";

/**
 * Renders a message's attachments (Decision 7). Images show as inline thumbnails
 * that open a full-size modal; everything else is a download chip with a file
 * icon, name, and size.
 */
export function AttachmentList({
  attachments,
}: {
  attachments: SignedAttachment[];
}) {
  const [preview, setPreview] = React.useState<SignedAttachment | null>(null);
  if (attachments.length === 0) return null;

  const images = attachments.filter((a) => isImageType(a.contentType));
  const files = attachments.filter((a) => !isImageType(a.contentType));

  return (
    <div className="mt-1.5 space-y-1.5">
      {images.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {images.map((a) => (
            <button
              key={a.path}
              type="button"
              onClick={() => setPreview(a)}
              className="ring-border focus-visible:ring-ring overflow-hidden rounded-md ring-1 transition hover:opacity-90 focus-visible:ring-2 focus-visible:outline-none"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={a.url}
                alt={a.name}
                className="max-h-48 max-w-[16rem] object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}

      {files.map((a) => (
        <a
          key={a.path}
          href={a.url}
          target="_blank"
          rel="noopener noreferrer"
          download={a.name}
          className="bg-muted/40 hover:bg-muted flex max-w-sm items-center gap-2 rounded-md border px-2.5 py-2 text-sm transition"
        >
          <FileText className="text-muted-foreground size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{a.name}</span>
          {a.size != null ? (
            <span className="text-muted-foreground shrink-0 text-xs">
              {formatBytes(a.size)}
            </span>
          ) : null}
          <Download className="text-muted-foreground size-4 shrink-0" />
        </a>
      ))}

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl p-2">
          <DialogTitle className="sr-only">{preview?.name}</DialogTitle>
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview.url}
              alt={preview.name}
              className="max-h-[80vh] w-full rounded object-contain"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
