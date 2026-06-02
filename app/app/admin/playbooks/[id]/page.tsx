import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BarChart3 } from "lucide-react";

import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { getPlaybookAdmin } from "@/lib/playbooks/playbooks";
import {
  listPlaybookSections,
  listPlaybookModules,
} from "@/lib/playbooks/content";
import type { PlaybookStatus } from "@/lib/constants/playbooks";
import { formatDate } from "@/lib/utils/format";
import { PageHeader } from "@/components/shared/page-header";
import { StatusChip } from "@/components/shared/status-chip";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlaybookForm } from "@/components/playbooks/admin/playbook-form";
import { PlaybookContentEditor } from "@/components/playbooks/admin/playbook-content-editor";
import { PlaybookStatusActions } from "@/components/playbooks/admin/playbook-status-actions";

export const metadata: Metadata = { title: "Edit playbook · TeamApp" };

const STATUS_VARIANT: Record<
  PlaybookStatus,
  "neutral" | "success" | "warning"
> = {
  draft: "neutral",
  published: "success",
  archived: "warning",
};

export default async function EditPlaybookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSuperAdmin();
  const { id } = await params;
  const playbook = await getPlaybookAdmin(id);
  if (!playbook) notFound();

  const [sections, modules] = await Promise.all([
    listPlaybookSections(id),
    listPlaybookModules(id),
  ]);
  const status = playbook.status as PlaybookStatus;

  return (
    <div className="space-y-6">
      <Link
        href="/app/admin/playbooks"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Playbook Library
      </Link>

      <PageHeader
        title={playbook.title}
        description={`Last updated ${formatDate(playbook.updated_at, "relative")}`}
        action={
          <div className="flex items-center gap-2">
            <StatusChip variant={STATUS_VARIANT[status]}>{status}</StatusChip>
            <Button asChild variant="outline">
              <Link href={`/app/admin/playbooks/${id}/installs`}>
                <BarChart3 className="size-4" /> Installs
              </Link>
            </Button>
            <PlaybookStatusActions playbookId={id} status={status} />
          </div>
        }
      />

      <Tabs defaultValue="content">
        <TabsList>
          <TabsTrigger value="metadata">Metadata</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
        </TabsList>
        <TabsContent value="metadata" className="pt-4">
          <PlaybookForm
            mode="edit"
            initial={{
              id: playbook.id,
              title: playbook.title,
              slug: playbook.slug,
              description: playbook.description ?? "",
              category: playbook.category,
              iconName: playbook.icon_name ?? "",
              coverGradient: playbook.cover_gradient ?? "",
              creditText: playbook.credit_text ?? "",
              recommendedForOnboarding: playbook.recommended_for_onboarding,
            }}
          />
        </TabsContent>
        <TabsContent value="content" className="pt-4">
          <PlaybookContentEditor
            playbookId={id}
            sections={sections}
            modules={modules}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
