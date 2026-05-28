import type { Metadata } from "next";
import { Flag } from "lucide-react";

import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { getFlagsData, FLAG_DESCRIPTIONS } from "@/lib/admin/flags";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { FlagEditor } from "@/components/admin/flag-editor";

export const metadata: Metadata = { title: "Feature flags · TeamApp" };

export default async function AdminFlagsPage() {
  await requireSuperAdmin();
  const { flags, companies } = await getFlagsData();

  // Surface the canonical description when the DB row hasn't set one.
  const decorated = flags.map((f) => ({
    ...f,
    description: f.description ?? FLAG_DESCRIPTIONS[f.key] ?? null,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Feature flags"
        description="Server-side flags. Enable globally or override per company. Consuming code lands in later phases."
      />

      {decorated.length === 0 ? (
        <EmptyState
          icon={Flag}
          title="No feature flags yet"
          description="Run the seed (pnpm db:seed) to create the platform flag set."
        />
      ) : (
        <FlagEditor flags={decorated} companies={companies} />
      )}
    </div>
  );
}
