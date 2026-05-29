"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, MoreHorizontal, Plus } from "lucide-react";

import type { ModuleRow } from "@/lib/team/modules";
import type { SectionRow } from "@/lib/team/sections";
import { formatDate } from "@/lib/utils/format";
import { moveModuleAction, archiveModule } from "@/app/app/management/actions";
import { ModuleDrawer } from "@/components/team/module-drawer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusChip } from "@/components/shared/status-chip";
import { EmptyState } from "@/components/shared/empty-state";
import { BookOpen } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const CONTAINER_PREFIX = "section:";

function formatLength(min: number | null): string {
  return min == null ? "—" : `${min} min`;
}

function ModuleItem({
  module,
  onEdit,
  onArchive,
  disabled,
}: {
  module: ModuleRow;
  onEdit: () => void;
  onArchive: () => void;
  disabled: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: module.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="flex items-center gap-3 border-b px-3 py-2 last:border-0"
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring cursor-grab touch-none rounded focus-visible:ring-2 focus-visible:outline-none active:cursor-grabbing"
        aria-label={`Reorder ${module.title}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{module.title}</div>
        {module.description && (
          <div className="text-muted-foreground truncate text-xs">
            {module.description}
          </div>
        )}
      </div>
      <span className="text-muted-foreground w-16 shrink-0 text-right text-xs">
        {formatLength(module.estimated_minutes)}
      </span>
      <StatusChip domain="training_publish" status={module.status} />
      <span
        suppressHydrationWarning
        className="text-muted-foreground hidden w-24 shrink-0 text-right text-xs sm:block"
      >
        {formatDate(module.updated_at, "relative")}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Module actions"
            disabled={disabled}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a
              href={`/app/training/${module.id}?preview=1`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Preview as agent
            </a>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={onArchive}>
            Archive
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function SectionGroup({
  section,
  children,
  onAdd,
}: {
  section: SectionRow;
  children: React.ReactNode;
  onAdd: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${CONTAINER_PREFIX}${section.id}`,
  });
  return (
    <Card className="overflow-hidden py-0">
      <div className="bg-muted/40 flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-semibold">{section.title}</span>
        <Button variant="ghost" size="sm" onClick={onAdd}>
          <Plus className="size-3.5" /> Add module
        </Button>
      </div>
      <div
        ref={setNodeRef}
        className={isOver ? "bg-accent/40 min-h-12" : "min-h-12"}
      >
        {children}
      </div>
    </Card>
  );
}

export function ModulesTab({
  modules,
  sections,
  companyId,
}: {
  modules: ModuleRow[];
  sections: SectionRow[];
  companyId: string;
}) {
  const router = useRouter();
  const moduleById = React.useMemo(
    () => new Map(modules.map((m) => [m.id, m])),
    [modules],
  );

  // Local arrangement: sectionId -> ordered module ids.
  const initial = React.useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const s of sections) map[s.id] = [];
    for (const m of modules) {
      (map[m.section_id] ??= []).push(m.id);
    }
    return map;
  }, [sections, modules]);

  const [groups, setGroups] = React.useState(initial);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ModuleRow | null>(null);
  const [createSectionId, setCreateSectionId] = React.useState<string>();
  const [pending, start] = React.useTransition();

  React.useEffect(() => setGroups(initial), [initial]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function findContainer(id: string): string | undefined {
    if (id.startsWith(CONTAINER_PREFIX))
      return id.slice(CONTAINER_PREFIX.length);
    return Object.keys(groups).find((sid) => groups[sid].includes(id));
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const from = findContainer(activeId);
    const to = findContainer(overId);
    if (!from || !to || from === to) return;

    setGroups((prev) => {
      const next = { ...prev, [from]: [...prev[from]], [to]: [...prev[to]] };
      next[from] = next[from].filter((id) => id !== activeId);
      const overIndex = overId.startsWith(CONTAINER_PREFIX)
        ? next[to].length
        : next[to].indexOf(overId);
      next[to].splice(overIndex < 0 ? next[to].length : overIndex, 0, activeId);
      return next;
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const to = findContainer(overId);
    if (!to) return;

    // Compute the final arrangement from the CURRENT committed state (which
    // already reflects any cross-section moves applied during handleDragOver).
    // Critically, compute + persist OUTSIDE the setState updater — calling a
    // server action (revalidatePath) from inside an updater runs during render
    // and throws "Cannot update a component while rendering".
    const list = [...(groups[to] ?? [])];
    const oldIndex = list.indexOf(activeId);
    if (oldIndex < 0) return;
    let newIndex = overId.startsWith(CONTAINER_PREFIX)
      ? list.length - 1
      : list.indexOf(overId);
    if (newIndex < 0) newIndex = list.length - 1;
    if (oldIndex !== newIndex) {
      list.splice(oldIndex, 1);
      list.splice(newIndex, 0, activeId);
    }
    setGroups((prev) => ({ ...prev, [to]: list }));

    const finalIndex = list.indexOf(activeId);
    start(async () => {
      const res = await moveModuleAction(activeId, to, finalIndex);
      if (!res.ok) {
        toast.error("Could not move the module.");
        router.refresh();
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

  function openCreate(sectionId?: string) {
    setEditing(null);
    setCreateSectionId(sectionId);
    setDrawerOpen(true);
  }
  function openEdit(m: ModuleRow) {
    setEditing(m);
    setCreateSectionId(undefined);
    setDrawerOpen(true);
  }

  if (sections.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title="No sections yet"
        description="Create a section first, then add modules to it."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => openCreate()}>
          <Plus className="size-4" /> Add new
        </Button>
      </div>

      <DndContext
        id="modules-dnd"
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="space-y-3">
          {sections.map((s) => {
            const ids = groups[s.id] ?? [];
            return (
              <SectionGroup
                key={s.id}
                section={s}
                onAdd={() => openCreate(s.id)}
              >
                <SortableContext
                  items={ids}
                  strategy={verticalListSortingStrategy}
                >
                  {ids.length === 0 ? (
                    <p className="text-muted-foreground px-3 py-3 text-xs">
                      No modules — drag one here or add new.
                    </p>
                  ) : (
                    ids.map((id) => {
                      const m = moduleById.get(id);
                      if (!m) return null;
                      return (
                        <ModuleItem
                          key={id}
                          module={m}
                          disabled={pending}
                          onEdit={() => openEdit(m)}
                          onArchive={() =>
                            run(() => archiveModule(m.id), "Module archived.")
                          }
                        />
                      );
                    })
                  )}
                </SortableContext>
              </SectionGroup>
            );
          })}
        </div>
      </DndContext>

      <ModuleDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        module={editing}
        sections={sections}
        companyId={companyId}
        defaultSectionId={createSectionId}
      />
    </div>
  );
}
