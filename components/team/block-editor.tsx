"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  Heading,
  Image as ImageIcon,
  Link as LinkIcon,
  Paperclip,
  Pilcrow,
  Plus,
  Trash2,
  TriangleAlert,
  Video,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { uploadModuleContent, getModuleContentUrl } from "@/lib/storage";
import {
  youtubeEmbedUrl,
  type ContentBlock,
  type ContentBlockType,
} from "@/lib/team/content";
import { RichText } from "@/components/team/rich-text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const BLOCK_TYPES: {
  type: ContentBlockType;
  label: string;
  icon: React.ElementType;
}[] = [
  { type: "heading", label: "Heading", icon: Heading },
  { type: "paragraph", label: "Paragraph", icon: Pilcrow },
  { type: "link", label: "Link", icon: LinkIcon },
  { type: "video_embed", label: "Video embed", icon: Video },
  { type: "image", label: "Image", icon: ImageIcon },
  { type: "file_attachment", label: "File attachment", icon: Paperclip },
  { type: "callout", label: "Callout", icon: TriangleAlert },
];

function emptyBlock(type: ContentBlockType): ContentBlock {
  switch (type) {
    case "heading":
      return { type: "heading", level: 2, text: "" };
    case "paragraph":
      return { type: "paragraph", text: "" };
    case "link":
      return { type: "link", url: "", label: "" };
    case "video_embed":
      return { type: "video_embed", provider: "youtube", url: "" };
    case "image":
      return { type: "image", storage_path: "", alt: "" };
    case "file_attachment":
      return {
        type: "file_attachment",
        storage_path: "",
        filename: "",
        size_bytes: 0,
      };
    case "callout":
      return { type: "callout", variant: "info", text: "" };
  }
}

export function BlockEditor({
  blocks,
  onChange,
  companyId,
  sectionId,
  moduleFolderId,
}: {
  blocks: ContentBlock[];
  onChange: (blocks: ContentBlock[]) => void;
  companyId: string;
  sectionId: string;
  moduleFolderId: string;
}) {
  const [previews, setPreviews] = React.useState<Record<string, string>>({});

  // Resolve signed URLs for any image blocks that have a storage path.
  React.useEffect(() => {
    const supabase = createClient();
    const missing = blocks
      .filter(
        (b): b is Extract<ContentBlock, { type: "image" }> =>
          b.type === "image" && !!b.storage_path,
      )
      .map((b) => b.storage_path)
      .filter((p) => !previews[p]);
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      const entries: [string, string][] = [];
      for (const path of missing) {
        try {
          const url = await getModuleContentUrl(supabase, path);
          entries.push([path, url]);
        } catch {
          /* ignore preview failures */
        }
      }
      if (!cancelled && entries.length) {
        setPreviews((p) => ({ ...p, ...Object.fromEntries(entries) }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [blocks, previews]);

  function update(index: number, next: ContentBlock) {
    onChange(blocks.map((b, i) => (i === index ? next : b)));
  }
  function add(type: ContentBlockType) {
    onChange([...blocks, emptyBlock(type)]);
  }
  function remove(index: number) {
    onChange(blocks.filter((_, i) => i !== index));
  }
  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  async function uploadFile(file: File): Promise<{ path: string } | null> {
    try {
      const supabase = createClient();
      const res = await uploadModuleContent(supabase, {
        companyId,
        sectionId: sectionId || "unsectioned",
        moduleId: moduleFolderId,
        filename: file.name,
        file,
      });
      return res;
    } catch (err) {
      console.error(err);
      toast.error("Upload failed. Check your connection and try again.");
      return null;
    }
  }

  return (
    <div className="space-y-3">
      <Label>Content</Label>
      {blocks.length === 0 && (
        <p className="text-muted-foreground rounded-md border border-dashed p-4 text-center text-sm">
          No content blocks yet. Add one below.
        </p>
      )}

      {blocks.map((block, index) => (
        <div key={index} className="rounded-md border p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-medium uppercase">
              {block.type.replace(/_/g, " ")}
            </span>
            <div className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Move block up"
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                <ArrowUp className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Move block down"
                disabled={index === blocks.length - 1}
                onClick={() => move(index, 1)}
              >
                <ArrowDown className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Delete block"
                onClick={() => remove(index)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>

          {block.type === "heading" && (
            <div className="flex gap-2">
              <Select
                value={String(block.level)}
                onValueChange={(v) =>
                  update(index, { ...block, level: Number(v) as 1 | 2 | 3 })
                }
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">H1</SelectItem>
                  <SelectItem value="2">H2</SelectItem>
                  <SelectItem value="3">H3</SelectItem>
                </SelectContent>
              </Select>
              <Input
                value={block.text}
                onChange={(e) =>
                  update(index, { ...block, text: e.target.value })
                }
                placeholder="Heading text"
              />
            </div>
          )}

          {block.type === "paragraph" && (
            <RichText
              value={block.text}
              onChange={(html) => update(index, { ...block, text: html })}
              placeholder="Paragraph"
            />
          )}

          {block.type === "callout" && (
            <div className="space-y-2">
              <Select
                value={block.variant}
                onValueChange={(v) =>
                  update(index, {
                    ...block,
                    variant: v as "info" | "warning" | "tip",
                  })
                }
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="tip">Tip</SelectItem>
                </SelectContent>
              </Select>
              <RichText
                value={block.text}
                onChange={(html) => update(index, { ...block, text: html })}
                placeholder="Callout text"
              />
            </div>
          )}

          {block.type === "link" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Label</Label>
                <Input
                  value={block.label}
                  onChange={(e) =>
                    update(index, { ...block, label: e.target.value })
                  }
                  placeholder="Read the guide"
                />
              </div>
              <div>
                <Label className="text-xs">URL</Label>
                <Input
                  value={block.url}
                  onChange={(e) =>
                    update(index, { ...block, url: e.target.value })
                  }
                  placeholder="https://example.com"
                />
              </div>
            </div>
          )}

          {block.type === "video_embed" && (
            <div className="space-y-2">
              <Input
                value={block.url}
                onChange={(e) =>
                  update(index, { ...block, url: e.target.value })
                }
                placeholder="https://www.youtube.com/watch?v=…"
              />
              {youtubeEmbedUrl(block.url) ? (
                <div className="aspect-video w-full overflow-hidden rounded-md border">
                  <iframe
                    src={youtubeEmbedUrl(block.url)!}
                    title="Video preview"
                    className="h-full w-full"
                    allowFullScreen
                  />
                </div>
              ) : block.url ? (
                <p className="text-destructive text-xs">
                  Not a recognized YouTube URL.
                </p>
              ) : null}
            </div>
          )}

          {block.type === "image" && (
            <div className="space-y-2">
              {block.storage_path && previews[block.storage_path] && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={previews[block.storage_path]}
                  alt={block.alt}
                  className="max-h-48 rounded-md border"
                />
              )}
              <Input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  const res = await uploadFile(file);
                  if (res) update(index, { ...block, storage_path: res.path });
                }}
              />
              <div>
                <Label className="text-xs">Alt text</Label>
                <Input
                  value={block.alt}
                  onChange={(e) =>
                    update(index, { ...block, alt: e.target.value })
                  }
                  placeholder="Describe the image"
                />
              </div>
            </div>
          )}

          {block.type === "file_attachment" && (
            <div className="space-y-2">
              {block.filename && (
                <p className="text-sm">
                  Attached:{" "}
                  <span className="font-medium">{block.filename}</span>
                </p>
              )}
              <Input
                type="file"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  const res = await uploadFile(file);
                  if (res)
                    update(index, {
                      ...block,
                      storage_path: res.path,
                      filename: file.name,
                      size_bytes: file.size,
                    });
                }}
              />
            </div>
          )}
        </div>
      ))}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            <Plus className="size-4" /> Add block
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {BLOCK_TYPES.map(({ type, label, icon: Icon }) => (
            <DropdownMenuItem key={type} onClick={() => add(type)}>
              <Icon className="size-4" /> {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
