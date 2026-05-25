import type { Metadata } from "next";

import { getSessionProfile } from "@/lib/auth/profile";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Dashboard · TeamApp" };

/** Time-of-day greeting. */
function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  const session = await getSessionProfile();
  const firstName = session?.profile.full_name?.trim().split(/\s+/)[0] ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting()}${firstName ? `, ${firstName}` : ""}`}
        description="Your dashboard is coming together."
      />
    </div>
  );
}
