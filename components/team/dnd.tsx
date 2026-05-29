"use client";

import * as React from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

import { cn } from "@/lib/utils/index";
import { TableRow } from "@/components/ui/table";

type HandleProps = {
  attributes: React.HTMLAttributes<HTMLElement>;
  listeners: Record<string, (...args: unknown[]) => void> | undefined;
  setActivatorNodeRef: (el: HTMLElement | null) => void;
};

const HandleContext = React.createContext<HandleProps | null>(null);

/** Six-dot grab handle. Place once inside each SortableRow. */
export function DragHandle({ label = "Drag to reorder" }: { label?: string }) {
  const ctx = React.useContext(HandleContext);
  if (!ctx) return null;
  return (
    <button
      type="button"
      ref={ctx.setActivatorNodeRef}
      className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex cursor-grab touch-none items-center rounded focus-visible:ring-2 focus-visible:outline-none active:cursor-grabbing"
      aria-label={label}
      {...ctx.attributes}
      {...ctx.listeners}
    >
      <GripVertical className="size-4" />
    </button>
  );
}

/** A draggable <TableRow>. Render a <DragHandle/> in its first cell. */
export function SortableRow({
  id,
  children,
  className,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <HandleContext.Provider
      value={{
        attributes: attributes as React.HTMLAttributes<HTMLElement>,
        listeners: listeners as HandleProps["listeners"],
        setActivatorNodeRef,
      }}
    >
      <TableRow
        ref={setNodeRef}
        style={style}
        className={cn(isDragging && "relative z-10", className)}
      >
        {children}
      </TableRow>
    </HandleContext.Provider>
  );
}

/**
 * Wraps a sortable table. `ids` is the ordered id list; `onReorder` fires with
 * the new order after a drop (mouse or keyboard). Keyboard support comes from
 * dnd-kit's KeyboardSensor (Space to pick up, arrows to move, Space to drop)
 * with built-in screen-reader announcements.
 *
 * IMPORTANT: this renders the <DndContext> (which injects hidden a11y <div>s),
 * so it must wrap the WHOLE table — never sit inside <tbody> (invalid DOM).
 * Place the sortable <SortableRow>s as descendants in the table body.
 */
export function SortableTable({
  id,
  ids,
  onReorder,
  children,
}: {
  /** Stable DndContext id — required so SSR/client a11y ids match (no hydration warning). */
  id: string;
  ids: string[];
  onReorder: (orderedIds: string[]) => void;
  children: React.ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(ids, oldIndex, newIndex));
  }

  return (
    <DndContext
      id={id}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

export { arrayMove };
