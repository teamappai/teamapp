import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { PageHeader } from "@/components/shared/page-header";
import { PlaybookForm } from "@/components/playbooks/admin/playbook-form";

export const metadata: Metadata = { title: "New playbook · TeamApp" };

export default async function NewPlaybookPage() {
  await requireSuperAdmin();
  return (
    <div className="space-y-6">
      <Link
        href="/app/admin/playbooks"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Playbook Library
      </Link>
      <PageHeader
        title="Create playbook"
        description="Set the basics — you'll add sections and modules after saving."
      />
      <PlaybookForm mode="create" />
    </div>
  );
}
