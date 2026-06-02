import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { getPlaybookAdmin } from "@/lib/playbooks/playbooks";
import { listInstallsForPlaybook } from "@/lib/playbooks/installs";
import { getPlan } from "@/lib/billing/plans";
import { formatDate } from "@/lib/utils/format";
import { PageHeader } from "@/components/shared/page-header";
import { StatusChip } from "@/components/shared/status-chip";
import { EmptyState } from "@/components/shared/empty-state";
import { Inbox } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = { title: "Playbook installs · TeamApp" };

export default async function PlaybookInstallsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSuperAdmin();
  const { id } = await params;
  const playbook = await getPlaybookAdmin(id);
  if (!playbook) notFound();

  const installs = await listInstallsForPlaybook(id);
  const active = installs.filter((i) => !i.uninstalledAt).length;

  return (
    <div className="space-y-6">
      <Link
        href={`/app/admin/playbooks/${id}`}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> {playbook.title}
      </Link>
      <PageHeader
        title="Installs"
        description={`${active} active install${active === 1 ? "" : "s"} · ${installs.length} total (incl. uninstalled)`}
      />

      {installs.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No installs yet"
          description="Once customers install this playbook, they'll appear here."
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Installed</TableHead>
                <TableHead>Installed by</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {installs.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-medium">{i.companyName}</TableCell>
                  <TableCell>{getPlan(i.plan).display_name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(i.installedAt)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {i.installedByName ?? "—"}
                  </TableCell>
                  <TableCell>
                    {i.uninstalledAt ? (
                      <StatusChip variant="neutral">uninstalled</StatusChip>
                    ) : (
                      <StatusChip variant="success">active</StatusChip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
