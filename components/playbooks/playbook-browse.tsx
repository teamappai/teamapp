"use client";

import * as React from "react";
import Link from "next/link";

import type { PlaybookWithCounts } from "@/lib/playbooks/playbooks";
import type { InstalledPlaybook } from "@/lib/playbooks/installs";
import { PlaybookCover } from "@/components/playbooks/playbook-cover";
import { UninstallButton } from "@/components/playbooks/uninstall-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusChip } from "@/components/shared/status-chip";
import { EmptyState } from "@/components/shared/empty-state";
import { Library } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils/index";

function BrowseCard({
  playbook,
  installed,
}: {
  playbook: PlaybookWithCounts;
  installed: boolean;
}) {
  return (
    <Card className="flex flex-col gap-3 overflow-hidden p-0">
      <PlaybookCover
        iconName={playbook.icon_name}
        gradient={playbook.cover_gradient}
        className="rounded-b-none"
      />
      <div className="flex flex-1 flex-col gap-2 p-4 pt-0">
        <h3 className="font-semibold">{playbook.title}</h3>
        <StatusChip variant="info" hideDot className="self-start">
          {playbook.category}
        </StatusChip>
        {playbook.description && (
          <p className="text-muted-foreground line-clamp-2 text-sm">
            {playbook.description}
          </p>
        )}
        {playbook.credit_text && (
          <p className="text-muted-foreground text-xs">
            {playbook.credit_text}
          </p>
        )}
        <p className="text-muted-foreground mt-auto text-xs">
          {playbook.sectionCount} section
          {playbook.sectionCount === 1 ? "" : "s"} · {playbook.moduleCount}{" "}
          module{playbook.moduleCount === 1 ? "" : "s"}
        </p>
        {installed ? (
          <Button variant="outline" disabled>
            Installed
          </Button>
        ) : (
          <Button asChild variant="outline">
            <Link href={`/app/playbooks/${playbook.id}`}>View details</Link>
          </Button>
        )}
      </div>
    </Card>
  );
}

export function PlaybookBrowse({
  playbooks,
  installedIds,
  installed,
}: {
  playbooks: PlaybookWithCounts[];
  installedIds: string[];
  installed: InstalledPlaybook[];
}) {
  const installedSet = React.useMemo(
    () => new Set(installedIds),
    [installedIds],
  );
  const categories = React.useMemo(
    () => [...new Set(playbooks.map((p) => p.category))].sort(),
    [playbooks],
  );
  const [category, setCategory] = React.useState<string>("all");
  const [search, setSearch] = React.useState("");

  const filtered = playbooks.filter((p) => {
    if (category !== "all" && p.category !== category) return false;
    if (search.trim() && !p.title.toLowerCase().includes(search.toLowerCase()))
      return false;
    return true;
  });

  return (
    <Tabs defaultValue="browse">
      <TabsList>
        <TabsTrigger value="browse">Browse</TabsTrigger>
        <TabsTrigger value="installed">
          Installed ({installed.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="browse" className="space-y-4 pt-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-1">
            <Button
              size="sm"
              variant={category === "all" ? "default" : "outline"}
              onClick={() => setCategory("all")}
            >
              All
            </Button>
            {categories.map((c) => (
              <Button
                key={c}
                size="sm"
                variant={category === c ? "default" : "outline"}
                onClick={() => setCategory(c)}
              >
                {c}
              </Button>
            ))}
          </div>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search playbooks…"
            className="max-w-xs"
          />
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={Library}
            title="No playbooks found"
            description="Try a different category or search term."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => (
              <BrowseCard
                key={p.id}
                playbook={p}
                installed={installedSet.has(p.id)}
              />
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="installed" className="pt-4">
        {installed.length === 0 ? (
          <EmptyState
            icon={Library}
            title="No playbooks installed yet"
            description="Browse the library to get started."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {installed.map((p) => (
              <Card
                key={p.id}
                className={cn("flex flex-col gap-3 overflow-hidden p-0")}
              >
                <PlaybookCover
                  iconName={p.icon_name}
                  gradient={p.cover_gradient}
                  className="rounded-b-none"
                />
                <div className="flex flex-1 flex-col gap-2 p-4 pt-0">
                  <h3 className="font-semibold">{p.title}</h3>
                  <StatusChip variant="info" hideDot className="self-start">
                    {p.category}
                  </StatusChip>
                  {p.description && (
                    <p className="text-muted-foreground line-clamp-2 text-sm">
                      {p.description}
                    </p>
                  )}
                  <div className="mt-auto flex items-center gap-2 pt-1">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/app/playbooks/${p.id}`}>Details</Link>
                    </Button>
                    <UninstallButton playbookId={p.id} title={p.title} />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
