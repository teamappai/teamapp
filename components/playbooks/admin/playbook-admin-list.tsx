"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";

import type { PlaybookWithCounts } from "@/lib/playbooks/playbooks";
import type { PlaybookStatus } from "@/lib/constants/playbooks";
import { formatDate } from "@/lib/utils/format";
import { setPlaybookStatusAction } from "@/app/app/admin/playbooks/actions";
import { PlaybookCover } from "@/components/playbooks/playbook-cover";
import { StatusChip } from "@/components/shared/status-chip";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils/index";

const STATUS_FILTERS: { value: PlaybookStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

const STATUS_VARIANT: Record<
  PlaybookStatus,
  "neutral" | "success" | "warning"
> = {
  draft: "neutral",
  published: "success",
  archived: "warning",
};

export function PlaybookAdminList({
  playbooks,
}: {
  playbooks: PlaybookWithCounts[];
}) {
  const router = useRouter();
  const [status, setStatus] = React.useState<PlaybookStatus | "all">("all");
  const [category, setCategory] = React.useState<string>("all");
  const [search, setSearch] = React.useState("");
  const [pending, start] = React.useTransition();

  const categories = React.useMemo(
    () => [...new Set(playbooks.map((p) => p.category))].sort(),
    [playbooks],
  );

  const filtered = playbooks.filter((p) => {
    if (status !== "all" && p.status !== status) return false;
    if (category !== "all" && p.category !== category) return false;
    if (search.trim() && !p.title.toLowerCase().includes(search.toLowerCase()))
      return false;
    return true;
  });

  function changeStatus(id: string, next: PlaybookStatus, label: string) {
    start(async () => {
      const res = await setPlaybookStatusAction(id, next);
      if (res.ok) {
        toast.success(label);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {STATUS_FILTERS.map((f) => (
            <Button
              key={f.value}
              size="sm"
              variant={status === f.value ? "default" : "outline"}
              onClick={() => setStatus(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title…"
          className="max-w-xs"
        />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Installs</TableHead>
              <TableHead>Last updated</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-muted-foreground py-8 text-center text-sm"
                >
                  No playbooks match these filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link
                      href={`/app/admin/playbooks/${p.id}`}
                      className="flex items-center gap-3 hover:underline"
                    >
                      <PlaybookCover
                        iconName={p.icon_name}
                        gradient={p.cover_gradient}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <span className="block truncate font-medium">
                          {p.title}
                        </span>
                        <span className="text-muted-foreground block truncate text-xs">
                          {p.sectionCount} sections · {p.moduleCount} modules
                        </span>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{p.category}</span>
                  </TableCell>
                  <TableCell>
                    <StatusChip
                      variant={STATUS_VARIANT[p.status as PlaybookStatus]}
                    >
                      {p.status}
                    </StatusChip>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {p.install_count}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(p.updated_at)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Actions"
                          disabled={pending}
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/app/admin/playbooks/${p.id}`}>
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/app/admin/playbooks/${p.id}/installs`}>
                            View installs
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/app/playbooks/${p.id}`}>
                            Preview as customer
                          </Link>
                        </DropdownMenuItem>
                        {p.status === "draft" && (
                          <DropdownMenuItem
                            onClick={() =>
                              changeStatus(p.id, "published", "Published.")
                            }
                          >
                            Publish
                          </DropdownMenuItem>
                        )}
                        {p.status === "published" && (
                          <DropdownMenuItem
                            onClick={() =>
                              changeStatus(p.id, "archived", "Archived.")
                            }
                          >
                            Archive
                          </DropdownMenuItem>
                        )}
                        {p.status === "archived" && (
                          <DropdownMenuItem
                            onClick={() =>
                              changeStatus(p.id, "published", "Republished.")
                            }
                          >
                            Republish
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <p
        className={cn("text-muted-foreground text-xs", pending && "opacity-50")}
      >
        {filtered.length} playbook{filtered.length === 1 ? "" : "s"}
      </p>
    </div>
  );
}
