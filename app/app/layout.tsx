import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/profile";
import { ctaForRole, navForRole } from "@/lib/constants/nav";
import { getOnboardingProgress } from "@/lib/training/progress";
import { getUnreadSummary } from "@/lib/messages/queries";
import {
  IMPERSONATION_ADMIN_ID_COOKIE,
  verifyValue,
} from "@/lib/auth/impersonation";
import { AppShell } from "@/components/layout/app-shell";
import { ImpersonationBanner } from "@/components/admin/impersonation-banner";
import { Identify } from "@/components/posthog/identify";
import { buildCompanyGroup } from "@/lib/posthog/company";
import type { SidebarData } from "@/components/layout/sidebar-content";
import type { HeaderIdentity } from "@/components/layout/header";
import type { NotificationItem } from "@/components/layout/notification-bell";

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
    onboarding = await getOnboardingProgress(
      supabase,
      profile.id,
      role,
      profile.company_id,
    );
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

  // In-app notifications for the header bell (Phase 9 / PA-2).
  const notifSupabase = await createClient();
  const { data: notifRows } = await notifSupabase
    .from("notifications")
    .select("id, kind, payload, read_at, created_at")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(15);
  const notifications: NotificationItem[] = (notifRows ?? []).map((n) => {
    const p = (n.payload ?? {}) as Record<string, unknown>;
    return {
      id: n.id,
      kind: n.kind,
      requestId: (p.request_id as string | undefined) ?? null,
      requestTitle: (p.request_title as string | undefined) ?? null,
      threadId: (p.thread_id as string | undefined) ?? null,
      coachingLogId: (p.coaching_log_id as string | undefined) ?? null,
      byName: (p.by_name as string | undefined) ?? null,
      claimed: p.claimed === true,
      read: n.read_at !== null,
      createdAt: n.created_at,
    };
  });

  // Unread messages badge for the header chat icon. Shares ONE source of truth
  // with the per-thread list badges (F-122) — both call getUnreadSummary.
  const { total: unreadMessages } = await getUnreadSummary(
    notifSupabase,
    profile.id,
  );

  // Show the persistent impersonation banner when a super_admin is acting as
  // this (impersonated) user. The signed cookie can't be forged by the target.
  const impersonating =
    verifyValue((await cookies()).get(IMPERSONATION_ADMIN_ID_COOKIE)?.value) !==
    null;

  // PostHog identify (hydration path): re-identifies on a refreshed session
  // where the login action never ran. Skipped while impersonating so a
  // super_admin acting-as a user doesn't overwrite their own analytics identity.
  const companyGroup =
    !impersonating && profile.company_id
      ? await buildCompanyGroup(notifSupabase, profile.company_id)
      : null;

  return (
    <>
      {!impersonating ? (
        <Identify
          user={{
            id: profile.id,
            email: profile.email,
            role,
            company_id: profile.company_id,
            created_at: profile.created_at,
          }}
          company={companyGroup}
        />
      ) : null}
      {impersonating ? (
        <ImpersonationBanner name={profile.full_name ?? profile.email} />
      ) : null}
      <AppShell
        sidebar={sidebar}
        identity={identity}
        unreadCount={unreadMessages}
        notifications={notifications}
      >
        {children}
      </AppShell>
    </>
  );
}
