import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/profile";
import { ctaForRole, navForRole } from "@/lib/constants/nav";
import { getOnboardingProgress } from "@/lib/training/progress";
import {
  IMPERSONATION_ADMIN_ID_COOKIE,
  verifyValue,
} from "@/lib/auth/impersonation";
import { AppShell } from "@/components/layout/app-shell";
import { ImpersonationBanner } from "@/components/admin/impersonation-banner";
import type { SidebarData } from "@/components/layout/sidebar-content";
import type { HeaderIdentity } from "@/components/layout/header";

/**
 * Authenticated app shell (Phase 3). Server Component: resolves the verified
 * session, computes the role-filtered nav server-side (audit CR-7), fetches the
 * agent onboarding progress, and hands serializable data to the client shell.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionProfile();
  if (!session) redirect("/login");

  const { profile, companyName } = session;
  const role = profile.role;

  // Company logo for the sidebar brand (non-super_admin). super_admin shows the
  // TeamApp wordmark instead (audit F-056), so skip the lookup.
  let logoUrl: string | null = null;
  if (role !== "super_admin" && profile.company_id) {
    const supabase = await createClient();
    const { data: company } = await supabase
      .from("companies")
      .select("logo_url")
      .eq("id", profile.company_id)
      .single();
    logoUrl = company?.logo_url ?? null;
  }

  // Onboarding widget is agents-only — never render a "0 of 0" for other roles.
  let onboarding: SidebarData["onboarding"] = null;
  if (role === "agent") {
    const supabase = await createClient();
    onboarding = await getOnboardingProgress(supabase, profile.id);
  }

  const sidebar: SidebarData = {
    role,
    companyName,
    logoUrl,
    navItems: navForRole(role),
    cta: ctaForRole(role),
    onboarding,
  };

  const identity: HeaderIdentity = {
    name: profile.full_name,
    role,
    avatarUrl: profile.avatar_url,
    seed: profile.id,
  };

  // Show the persistent impersonation banner when a super_admin is acting as
  // this (impersonated) user. The signed cookie can't be forged by the target.
  const impersonating =
    verifyValue((await cookies()).get(IMPERSONATION_ADMIN_ID_COOKIE)?.value) !==
    null;

  return (
    <>
      {impersonating ? (
        <ImpersonationBanner name={profile.full_name ?? profile.email} />
      ) : null}
      <AppShell sidebar={sidebar} identity={identity}>
        {children}
      </AppShell>
    </>
  );
}
