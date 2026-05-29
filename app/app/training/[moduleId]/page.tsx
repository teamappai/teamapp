import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, ShieldX } from "lucide-react";

import { getSessionProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { getModuleView } from "@/lib/training/experience";
import { parseBlocks } from "@/lib/team/content";
import { getModuleContentUrl } from "@/lib/storage/index";
import { EmptyState } from "@/components/shared/empty-state";
import { ModuleContentRenderer } from "@/components/training/module-content-renderer";
import { ModuleFooterNav } from "@/components/training/module-footer-nav";

export const metadata: Metadata = { title: "Training · TeamApp" };

export default async function ModuleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ moduleId: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const session = await getSessionProfile();
  if (!session) redirect("/login");

  const { moduleId } = await params;
  const preview = (await searchParams).preview === "1";
  const { profile } = session;

  const view = await getModuleView(
    profile.role,
    profile.company_id,
    profile.id,
    moduleId,
  );

  // Module isn't published/visible to this role (or doesn't exist) — 403.
  if (!view) {
    return (
      <div className="space-y-6">
        <EmptyState
          icon={ShieldX}
          title="Not available"
          description="This module isn't published or isn't assigned to your role."
          action={
            <Link
              href="/app/training"
              className="text-primary text-sm underline"
            >
              Back to training
            </Link>
          }
        />
      </div>
    );
  }

  const { module } = view;
  const blocks = parseBlocks(module.content);

  // Resolve signed URLs for embedded images/attachments (private bucket).
  const supabase = await createClient();
  const assetUrls: Record<string, string> = {};
  const paths = blocks
    .filter((b) => b.type === "image" || b.type === "file_attachment")
    .map((b) => (b as { storage_path: string }).storage_path)
    .filter(Boolean);
  await Promise.all(
    [...new Set(paths)].map(async (path) => {
      try {
        assetUrls[path] = await getModuleContentUrl(supabase, path);
      } catch {
        // Leave unresolved — the renderer skips images and disables downloads.
      }
    }),
  );

  // Team leads manage content; they don't track their own completion (PA-2).
  const canComplete = profile.role !== "team_lead" && !preview;

  return (
    <div className="space-y-6 pb-24">
      <nav className="text-muted-foreground flex flex-wrap items-center gap-1 text-sm">
        <Link href="/app/training" className="hover:text-foreground">
          Training
        </Link>
        <ChevronRight className="size-3.5" aria-hidden />
        <span>{view.sectionTitle}</span>
        <ChevronRight className="size-3.5" aria-hidden />
        <span className="text-foreground font-medium">{module.title}</span>
      </nav>

      {preview ? (
        <div className="rounded-lg border border-dashed bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          Preview mode — your progress isn&apos;t being tracked.
        </div>
      ) : null}

      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {module.title}
        </h1>
        {module.description ? (
          <p className="text-muted-foreground">{module.description}</p>
        ) : null}
      </header>

      <article className="max-w-3xl">
        <ModuleContentRenderer blocks={blocks} assetUrls={assetUrls} />
      </article>

      <ModuleFooterNav
        moduleId={module.id}
        prevId={view.prevId}
        nextId={view.nextId}
        index={view.index}
        total={view.total}
        isCompleted={module.progressStatus === "completed"}
        canComplete={canComplete}
        preview={preview}
      />
    </div>
  );
}
