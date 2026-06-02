import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { listPlaybooksAdmin } from "@/lib/playbooks/playbooks";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { PlaybookAdminList } from "@/components/playbooks/admin/playbook-admin-list";

export const metadata: Metadata = { title: "Playbook Library · TeamApp" };

export default async function AdminPlaybooksPage() {
  await requireSuperAdmin();
  const playbooks = await listPlaybooksAdmin();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Playbook Library"
        description="Curated training content TeamApp customers can install into their workspaces."
        action={
          <Button asChild>
            <Link href="/app/admin/playbooks/new">
              <Plus className="size-4" /> Create playbook
            </Link>
          </Button>
        }
      />
      <PlaybookAdminList playbooks={playbooks} />
    </div>
  );
}
