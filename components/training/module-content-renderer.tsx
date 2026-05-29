import {
  Download,
  FileText,
  Info,
  Lightbulb,
  TriangleAlert,
} from "lucide-react";

import type { ContentBlock, CalloutVariant } from "@/lib/team/content";
import { youtubeEmbedUrl } from "@/lib/team/content";
import { formatBytes } from "@/lib/utils/format";
import { cn } from "@/lib/utils/index";
import { ExtLink } from "@/components/shared/ext-link";

/**
 * Renders the block-based module content for the agent learner view (Phase 7).
 * Links become real anchors (F-066), YouTube embeds become iframes (F-069/SR-6),
 * images and file attachments resolve to signed URLs that the server passes in
 * via `assetUrls` (keyed by storage_path). Unknown block types degrade to plain
 * text + a console warning rather than crashing the page.
 */
type Props = {
  blocks: ContentBlock[];
  /** storage_path -> signed URL, resolved server-side for image/file blocks. */
  assetUrls: Record<string, string>;
};

const CALLOUT_STYLES: Record<
  CalloutVariant,
  { icon: typeof Info; className: string; label: string }
> = {
  info: {
    icon: Info,
    className:
      "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-100",
    label: "Info",
  },
  warning: {
    icon: TriangleAlert,
    className:
      "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-100",
    label: "Warning",
  },
  tip: {
    icon: Lightbulb,
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100",
    label: "Tip",
  },
};

function HeadingBlock({ level, text }: { level: 1 | 2 | 3; text: string }) {
  // The module title owns the page <h1>; content headings start at <h2> to keep
  // a single top-level heading and a sensible document outline (a11y).
  const className =
    level === 1
      ? "mt-8 text-xl font-semibold tracking-tight"
      : level === 2
        ? "mt-6 text-lg font-semibold"
        : "mt-4 text-base font-semibold";
  if (level === 1) return <h2 className={className}>{text}</h2>;
  if (level === 2) return <h3 className={className}>{text}</h3>;
  return <h4 className={className}>{text}</h4>;
}

function CalloutBlock({
  variant,
  text,
}: {
  variant: CalloutVariant;
  text: string;
}) {
  const style = CALLOUT_STYLES[variant] ?? CALLOUT_STYLES.info;
  const Icon = style.icon;
  return (
    <div
      className={cn(
        "flex gap-3 rounded-lg border p-4 text-sm",
        style.className,
      )}
    >
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div
        className="prose-sm min-w-0 [&_a]:underline"
        dangerouslySetInnerHTML={{ __html: text }}
      />
    </div>
  );
}

function VideoBlock({ url }: { url: string }) {
  const embed = youtubeEmbedUrl(url);
  if (!embed) {
    // Non-YouTube or unparseable: fall back to a real link rather than nothing.
    return (
      <ExtLink href={url} className="text-sm">
        Watch video
      </ExtLink>
    );
  }
  return (
    <div className="aspect-video w-full overflow-hidden rounded-lg border">
      <iframe
        src={embed}
        title="Embedded video"
        className="size-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}

export function ModuleContentRenderer({ blocks, assetUrls }: Props) {
  if (blocks.length === 0) {
    return (
      <p className="text-muted-foreground text-sm italic">
        This module doesn&apos;t have any content yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "heading":
            return (
              <HeadingBlock key={i} level={block.level} text={block.text} />
            );
          case "paragraph":
            return (
              <p
                key={i}
                className="[&_a]:text-primary text-sm leading-relaxed [&_a]:underline [&_a]:underline-offset-4"
                dangerouslySetInnerHTML={{ __html: block.text }}
              />
            );
          case "callout":
            return (
              <CalloutBlock key={i} variant={block.variant} text={block.text} />
            );
          case "link":
            return (
              <p key={i} className="text-sm">
                <ExtLink href={block.url}>{block.label || block.url}</ExtLink>
              </p>
            );
          case "video_embed":
            return <VideoBlock key={i} url={block.url} />;
          case "image": {
            const src = assetUrls[block.storage_path];
            if (!src) return null;
            return (
              // eslint-disable-next-line @next/next/no-img-element -- signed URL, not a static asset
              <img
                key={i}
                src={src}
                alt={block.alt}
                loading="lazy"
                className="max-w-full rounded-lg border"
              />
            );
          }
          case "file_attachment": {
            const href = assetUrls[block.storage_path];
            return (
              <a
                key={i}
                href={href ?? "#"}
                download={block.filename}
                className="hover:bg-accent/50 flex items-center gap-3 rounded-lg border p-3 text-sm transition-colors"
              >
                <FileText
                  className="text-muted-foreground size-5 shrink-0"
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate font-medium">
                  {block.filename}
                </span>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {formatBytes(block.size_bytes)}
                </span>
                <Download
                  className="text-muted-foreground size-4 shrink-0"
                  aria-hidden
                />
              </a>
            );
          }
          default: {
            const unknown = block as { type?: string };
            if (typeof console !== "undefined") {
              console.warn(
                `[training] unknown content block type: ${unknown.type}`,
              );
            }
            return null;
          }
        }
      })}
    </div>
  );
}
