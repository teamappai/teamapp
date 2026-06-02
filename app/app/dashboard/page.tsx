import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getSessionProfile } from "@/lib/auth/profile";
import { PageHeader } from "@/components/shared/page-header";
import { TeamLeadDashboard } from "@/components/dashboard/team-lead-dashboard";
import { AgentDashboard } from "@/components/dashboard/agent-dashboard";
import { AdminTcDashboard } from "@/components/dashboard/admin-tc-dashboard";
import { MarketingDashboard } from "@/components/dashboard/marketing-dashboard";

export const metadata: Metadata = { title: "Dashboard · TeamApp" };

/** Time-of-day greeting (fixes F-017). */
function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const session = await getSessionProfile();
  if (!session) redirect("/login");

  // Super-admin uses the dedicated admin console (existing from Phase 5).
  if (session.profile.role === "super_admin") redirect("/app/admin");

  const { profile } = session;
  const firstName = profile.full_name?.trim().split(/\s+/)[0] ?? null;
  const title = `${greeting()}${firstName ? `, ${firstName}` : ""}`;
  const companyId = profile.company_id;
  const role = profile.role;
  const sp = await searchParams;

  if (!companyId) {
    return (
      <div className="space-y-6">
        <PageHeader title={title} />
        <p className="text-muted-foreground text-sm">
          Your account isn&rsquo;t linked to a company yet.
        </p>
      </div>
    );
  }

  switch (role) {
    case "team_lead":
      return (
        <TeamLeadDashboard
          greeting={title}
          companyId={companyId}
          viewerId={session.user.id}
          searchParams={sp}
        />
      );
    case "agent":
      return (
        <div className="space-y-6">
          <PageHeader title={title} />
          <AgentDashboard
            userId={session.user.id}
            companyId={companyId}
            role={role}
          />
        </div>
      );
    case "admin_tc":
      return (
        <div className="space-y-6">
          <PageHeader title={title} />
          <AdminTcDashboard
            userId={session.user.id}
            companyId={companyId}
            role={role}
          />
        </div>
      );
    case "marketing":
      return (
        <div className="space-y-6">
          <PageHeader title={title} />
          <MarketingDashboard
            userId={session.user.id}
            companyId={companyId}
            role={role}
          />
        </div>
      );
    default:
      return (
        <div className="space-y-6">
          <PageHeader title={title} />
        </div>
      );
  }
}
