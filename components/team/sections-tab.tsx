"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal, Plus } from "lucide-react";

import type { SectionRow } from "@/lib/team/sections";
import { ROLE_LABELS } from "@/lib/constants/roles";
import { formatDate } from "@/lib/utils/format";
import {
  reorderSectionsAction,
  archiveSection,
  duplicateSectionAction,
} from "@/app/app/management/actions";
import { SectionDrawer } from "@/components/team/section-drawer";
import { SortableTable, SortableRow, DragHandle } from "@/components/team/dnd";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusChip } from "@/components/shared/status-chip";
import { EmptyState } from "@/components/shared/empty-state";
import { Layers } from "lucide-react";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function SectionsTab({ sections }: { sections: SectionRow[] }) {
  const router = useRouter();
  const [items, setItems] = React.useState(sections);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SectionRow | null>(null);
  const [pending, start] = React.useTransition();

  React.useEffect(() => setItems(sections), [sections]);

  function reorder(orderedIds: string[]) {
    const prev = items;
    const byId = new Map(items.map((s) => [s.id, s]));
    setItems(orderedIds.map((id) => byId.get(id)!).filter(Boolean));
    start(async () => {
      const res = await reorderSectionsAction(orderedIds);
      if (!res.ok) {
        setItems(prev); // rollback
        toast.error("Could not save the new order.");
      }
    });
  }

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) {
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(ok);
        router.refresh();
      } else {
        toast.error(res.error ?? "Something went wrong.");
      }
    });
  }

  function openCreate() {
    setEditing(null);
    setDrawerOpen(true);
  }
  function openEdit(s: SectionRow) {
    setEditing(s);
    setDrawerOpen(true);
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={openCreate}>
          <Plus className="size-4" /> Add new
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No sections yet"
          description="Create your first section to group training modules."
        />
      ) : (
        <SortableTable
          id="sections-dnd"
          ids={items.map((s) => s.id)}
          onReorder={reorder}
        >
          <Card className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Title</TableHead>
                  <TableHead>Visible to</TableHead>
                  <TableHead>Modules</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((s) => (
                  <SortableRow key={s.id} id={s.id}>
                    <TableCell className="w-8">
                      <DragHandle label={`Reorder ${s.title}`} />
                    </TableCell>
                    <TableCell className="font-medium">{s.title}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {s.visible_to_roles.length === 0 ? (
                          <StatusChip variant="neutral" hideDot>
                            All
                          </StatusChip>
                        ) : (
                          s.visible_to_roles.map((r) => (
                            <StatusChip key={r} variant="info" hideDot>
                              {ROLE_LABELS[r]}
                            </StatusChip>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{s.moduleCount}</TableCell>
                    <TableCell>
                      <StatusChip domain="training_publish" status={s.status} />
                    </TableCell>
                    <TableCell
                      suppressHydrationWarning
                      className="text-muted-foreground"
                    >
                      {formatDate(s.updated_at, "relative")}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Section actions"
                            disabled={pending}
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(s)}>
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              run(
                                () => duplicateSectionAction(s.id),
                                "Section duplicated.",
                              )
                            }
                          >
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              toast.info(
                                "Agent preview opens with the training view (Phase 7).",
                              )
                            }
                          >
                            Preview as agent
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() =>
                              run(
                                () => archiveSection(s.id),
                                "Section archived.",
                              )
                            }
                          >
                            Archive
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </SortableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </SortableTable>
      )}

      <SectionDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        section={editing}
      />
    </div>
  );
}
