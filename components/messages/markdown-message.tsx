"use client";

import * as React from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils/index";
import { isMentionHref, mentionsToMarkdown } from "@/lib/messages/mentions";

/**
 * Safe markdown renderer for message bodies (Decision 3 + markdown support).
 * Raw HTML is never parsed (no rehype-raw), images are degraded to their alt
 * text, and `<@id>` mention markers are rewritten to colored chips that link to
 * the (future) profile page. GFM gives us autolinks, strikethrough, and lists.
 */
export function MarkdownMessage({
  body,
  nameOf,
  className,
}: {
  body: string;
  /** Resolve a mentioned user id to a display name. */
  nameOf: (id: string) => string | undefined;
  className?: string;
}) {
  const source = React.useMemo(
    () => mentionsToMarkdown(body, nameOf),
    [body, nameOf],
  );

  return (
    <div
      className={cn(
        "text-sm leading-relaxed break-words",
        "[&_p]:my-0 [&_p+p]:mt-2",
        "[&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5",
        "[&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5",
        "[&_code]:bg-muted [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.85em]",
        "[&_pre]:bg-muted [&_pre]:my-1 [&_pre]:overflow-auto [&_pre]:rounded-md [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0",
        "[&_blockquote]:border-muted-foreground/30 [&_blockquote]:text-muted-foreground [&_blockquote]:border-l-2 [&_blockquote]:pl-3",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a({ href, children }) {
            if (isMentionHref(href)) {
              return (
                <Link
                  href={href!}
                  className="bg-primary/10 text-primary hover:bg-primary/20 rounded px-1 font-medium no-underline"
                >
                  {children}
                </Link>
              );
            }
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2"
              >
                {children}
              </a>
            );
          },
          // Degrade images to their alt text — never embed arbitrary remote URLs.
          img({ alt }) {
            return <span>{alt}</span>;
          },
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
