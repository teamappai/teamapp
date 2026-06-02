"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import { cn } from "@/lib/utils/index";
import type {
  PlaybookModule,
  PlaybookSectionWithCount,
} from "@/lib/playbooks/content";
import {
  deletePlaybookModuleAction,
  deletePlaybookSectionAction,
  reorderPlaybookModulesAction,
  reorderPlaybookSectionsAction,
} from "@/app/app/admin/playbooks/actions";
import { PlaybookSectionDrawer } from "@/components/playbooks/admin/playbook-section-drawer";
import { PlaybookModuleDrawer } from "@/components/playbooks/admin/playbook-module-drawer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { Layers } from "lucide-react";

export function PlaybookContentEditor({
  playbookId,
  sections,
  modules,
}: {
  playbookId: string;
  sections: PlaybookSectionWithCount[];
  modules: PlaybookModule[];
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = React.useState<string | null>(
    sections[0]?.id ?? null,
  );
  const [sectionDrawer, setSectionDrawer] = React.useState<{
    open: boolean;
    section: PlaybookSectionWithCount | null;
  }>({ open: false, section: null });
  const [moduleDrawer, setModuleDrawer] = React.useState<{
    open: boolean;
    module: PlaybookModule | null;
  }>({ open: false, module: null });
  const [pending, start] = React.useTransition();

  // Keep a valid selection as sections change.
  React.useEffect(() => {
    if (!selectedId || !sections.some((s) => s.id === selectedId)) {
      setSelectedId(sections[0]?.id ?? null);
    }
  }, [sections, selectedId]);

  const selected = sections.find((s) => s.id === selectedId) ?? null;
  const sectionModules = modules
    .filter((m) => m.playbook_section_id === selectedId)
    .sort((a, b) => a.position - b.position);

  function moveSection(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= sections.length) return;
    const ids = sections.map((s) => s.id);
    [ids[index], ids[next]] = [ids[next]!, ids[index]!];
    start(async () => {
      const res = await reorderPlaybookSectionsAction(playbookId, ids);
      if (res.ok) router.refresh();
      else toast.error(res.error);
    });
  }

  function moveModule(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= sectionModules.length) return;
    const ids = sectionModules.map((m) => m.id);
    [ids[index], ids[next]] = [ids[next]!, ids[index]!];
    start(async () => {
      const res = await reorderPlaybookModulesAction(playbookId, ids);
      if (res.ok) router.refresh();
      else toast.error(res.error);
    });
  }

  function removeSection(section: PlaybookSectionWithCount) {
    if (
      !confirm(
        `Delete "${section.title}" and its ${section.moduleCount} module(s)? This can't be undone.`,
      )
    )
      return;
    start(async () => {
      const res = await deletePlaybookSectionAction(playbookId, section.id);
      if (res.ok) {
        toast.success("Section deleted.");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function removeModule(m: PlaybookModule) {
    if (!confirm(`Delete "${m.title}"? This can't be undone.`)) return;
    start(async () => {
      const res = await deletePlaybookModuleAction(playbookId, m.id);
      if (res.ok) {
        toast.success("Module deleted.");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
      {/* Sections rail */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Sections</h3>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSectionDrawer({ open: true, section: null })}
          >
            <Plus className="size-4" /> Add
          </Button>
        </div>
        {sections.length === 0 ? (
          <p className="text-muted-foreground rounded-md border border-dashed p-4 text-center text-sm">
            No sections yet.
          </p>
        ) : (
          <ul className="space-y-1">
            {sections.map((s, i) => (
              <li key={s.id}>
                <div
                  className={cn(
                    "flex items-center gap-1 rounded-md border p-2",
                    selectedId === s.id && "border-primary bg-accent",
                  )}
                >
                  <div className="flex flex-col">
                    <button
                      type="button"
                      aria-label="Move section up"
                      disabled={i === 0 || pending}
                      onClick={() => moveSection(i, -1)}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <ArrowUp className="size-3" />
                    </button>
                    <button
                      type="button"
                      aria-label="Move section down"
                      disabled={i === sections.length - 1 || pending}
                      onClick={() => moveSection(i, 1)}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <ArrowDown className="size-3" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedId(s.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block truncate text-sm font-medium">
                      {s.title}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {s.moduleCount} module{s.moduleCount === 1 ? "" : "s"}
                    </span>
                  </button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Edit section"
                    onClick={() => setSectionDrawer({ open: true, section: s })}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Delete section"
                    onClick={() => removeSection(s)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Modules pane */}
      <div className="space-y-2">
        {selected ? (
          <>
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-1 text-sm font-semibold">
                <ChevronRight className="text-muted-foreground size-4" />
                {selected.title}
              </h3>
              <Button
                size="sm"
                onClick={() => setModuleDrawer({ open: true, module: null })}
              >
                <Plus className="size-4" /> Add module
              </Button>
            </div>
            {sectionModules.length === 0 ? (
              <p className="text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm">
                No modules in this section yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {sectionModules.map((m, i) => (
                  <li key={m.id}>
                    <Card className="flex items-center gap-2 p-3">
                      <div className="flex flex-col">
                        <button
                          type="button"
                          aria-label="Move module up"
                          disabled={i === 0 || pending}
                          onClick={() => moveModule(i, -1)}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                        >
                          <ArrowUp className="size-3" />
                        </button>
                        <button
                          type="button"
                          aria-label="Move module down"
                          disabled={i === sectionModules.length - 1 || pending}
                          onClick={() => moveModule(i, 1)}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                        >
                          <ArrowDown className="size-3" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setModuleDrawer({ open: true, module: m })
                        }
                        className="min-w-0 flex-1 text-left"
                      >
                        <span className="block truncate text-sm font-medium">
                          {m.title}
                        </span>
                        {m.description && (
                          <span className="text-muted-foreground block truncate text-xs">
                            {m.description}
                          </span>
                        )}
                      </button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Edit module"
                        onClick={() =>
                          setModuleDrawer({ open: true, module: m })
                        }
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Delete module"
                        onClick={() => removeModule(m)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <EmptyState
            icon={Layers}
            title="No section selected"
            description="Add a section on the left to start building this playbook."
          />
        )}
      </div>

      <PlaybookSectionDrawer
        open={sectionDrawer.open}
        onOpenChange={(open) => setSectionDrawer((s) => ({ ...s, open }))}
        playbookId={playbookId}
        section={sectionDrawer.section}
      />
      <PlaybookModuleDrawer
        open={moduleDrawer.open}
        onOpenChange={(open) => setModuleDrawer((s) => ({ ...s, open }))}
        playbookId={playbookId}
        module={moduleDrawer.module}
        sections={sections}
        defaultSectionId={selectedId ?? undefined}
      />
    </div>
  );
}
