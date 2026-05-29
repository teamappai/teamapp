"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, Clock, Search } from "lucide-react";

import type { UserRole } from "@/lib/constants/roles";
import { ROLE_LABELS } from "@/lib/constants/roles";
import type { ProgressStatus } from "@/lib/training/experience";
import { cn } from "@/lib/utils/index";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/shared/status-chip";
import { ProgressBar } from "@/components/training/progress-bar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type ExperienceModuleView = {
  id: string;
  title: string;
  description: string | null;
  estimatedMinutes: number | null;
  progressStatus: ProgressStatus;
  position: number;
};

export type ExperienceSectionView = {
  id: string;
  title: string;
  description: string | null;
  visibleToRoles: UserRole[];
  completedCount: number;
  createdAt: string;
  modules: ExperienceModuleView[];
};

type Filter = "all" | "not_started" | "in_progress" | "completed";
type Sort = "recommended" | "az" | "newest" | "shortest";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
];

function formatLength(min: number | null): string {
  return min == null ? "—" : `${min} min`;
}

function moduleMatches(
  m: ExperienceModuleView,
  query: string,
  filter: Filter,
): boolean {
  if (filter !== "all" && m.progressStatus !== filter) return false;
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    m.title.toLowerCase().includes(q) ||
    (m.description?.toLowerCase().includes(q) ?? false)
  );
}

function ModuleRow({ module }: { module: ExperienceModuleView }) {
  return (
    <div className="flex items-center gap-3 border-b px-4 py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{module.title}</div>
        {module.description ? (
          <div className="text-muted-foreground truncate text-sm">
            {module.description}
          </div>
        ) : null}
      </div>
      <span className="text-muted-foreground hidden shrink-0 items-center gap-1 text-xs sm:flex">
        <Clock className="size-3.5" aria-hidden />
        {formatLength(module.estimatedMinutes)}
      </span>
      <StatusChip domain="training" status={module.progressStatus} />
      <Button asChild size="sm" variant="outline">
        <Link href={`/app/training/${module.id}`}>View</Link>
      </Button>
    </div>
  );
}

function SectionCard({
  section,
  query,
  filter,
}: {
  section: ExperienceSectionView;
  query: string;
  filter: Filter;
}) {
  const [open, setOpen] = React.useState(true);

  const visibleModules = section.modules.filter((m) =>
    moduleMatches(m, query, filter),
  );
  // Hide a section entirely when an active search/filter empties it.
  if ((query || filter !== "all") && visibleModules.length === 0) return null;

  const total = section.modules.length;
  const percent =
    total === 0 ? 0 : Math.round((section.completedCount / total) * 100);

  return (
    <Card className="overflow-hidden py-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="hover:bg-muted/40 flex w-full items-start gap-3 px-4 py-4 text-left transition-colors"
      >
        <ChevronDown
          className={cn(
            "text-muted-foreground mt-1 size-5 shrink-0 transition-transform",
            open ? "" : "-rotate-90",
          )}
          aria-hidden
        />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{section.title}</span>
            {section.visibleToRoles.length === 0 ? (
              <StatusChip variant="neutral" hideDot>
                All roles
              </StatusChip>
            ) : (
              section.visibleToRoles.map((r) => (
                <StatusChip key={r} variant="info" hideDot>
                  {ROLE_LABELS[r]}
                </StatusChip>
              ))
            )}
          </div>
          {section.description ? (
            <p className="text-muted-foreground text-sm">
              {section.description}
            </p>
          ) : null}
          <div className="flex items-center gap-3">
            <ProgressBar percent={percent} className="max-w-xs" />
            <span className="text-muted-foreground shrink-0 text-xs">
              {section.completedCount} of {total} complete
            </span>
          </div>
        </div>
      </button>
      {open ? (
        <div className="border-t">
          {visibleModules.length === 0 ? (
            <p className="text-muted-foreground px-4 py-4 text-sm">
              No modules in this section yet.
            </p>
          ) : (
            visibleModules.map((m) => <ModuleRow key={m.id} module={m} />)
          )}
        </div>
      ) : null}
    </Card>
  );
}

export function TrainingExperience({
  sections,
  total,
}: {
  sections: ExperienceSectionView[];
  total: number;
}) {
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("all");
  const [sort, setSort] = React.useState<Sort>("recommended");

  const sorted = React.useMemo(() => {
    const copy = [...sections];
    if (sort === "az") {
      copy.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sort === "newest") {
      copy.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    } else if (sort === "shortest") {
      const len = (s: ExperienceSectionView) =>
        s.modules.reduce((sum, m) => sum + (m.estimatedMinutes ?? 0), 0);
      copy.sort((a, b) => len(a) - len(b));
    }
    // "recommended" keeps the server-provided position order.
    return copy;
  }, [sections, sort]);

  const anyVisible = sorted.some((s) =>
    s.modules.some((m) => moduleMatches(m, query, filter)),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search modules…"
            className="pl-9"
            aria-label="Search modules"
          />
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
          <SelectTrigger className="w-full sm:w-48" aria-label="Sort sections">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recommended">Recommended order</SelectItem>
            <SelectItem value="az">A–Z</SelectItem>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="shortest">Shortest first</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f.value}
            size="sm"
            variant={filter === f.value ? "default" : "outline"}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {total > 0 && !anyVisible ? (
        <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-8 text-center text-sm">
          No modules match your search and filters.
        </p>
      ) : (
        <div className="space-y-3">
          {sorted.map((s) => (
            <SectionCard key={s.id} section={s} query={query} filter={filter} />
          ))}
        </div>
      )}
    </div>
  );
}
