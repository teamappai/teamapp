import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { requireTeamLead } from "@/lib/auth/require-team-lead";
import { listTeamUsers } from "@/lib/team/users";
import { listModules } from "@/lib/team/modules";
import { PageHeader } from "@/components/shared/page-header";
import { UsersManager } from "@/components/team/users-manager";
import type { AssignableModule } from "@/components/team/invite-users-dialog";

export const metadata: Metadata = { title: "Users · TeamApp" };

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { companyId, profile } = await requireTeamLead();
  // super_admin manages users from the cross-company admin console.
  if (!companyId) redirect("/app/admin/users");

  const sp = await searchParams;
  const [rows, modules] = await Promise.all([
    listTeamUsers(companyId),
    listModules(companyId),
  ]);

  const assignableModules: AssignableModule[] = modules
    .filter((m) => m.status === "published")
    .map((m) => ({
      id: m.id,
      title: m.title,
      visibleToRoles: m.visible_to_roles,
    }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Invite teammates and manage everyone on your team."
      />
      <UsersManager
        rows={rows}
        currentUserId={profile.id}
        assignableModules={assignableModules}
        initialInviteOpen={sp.invite === "1"}
      />
    </div>
  );
}
