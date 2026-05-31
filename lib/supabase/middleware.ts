import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { roleHomePath } from "@/lib/constants/roles";

const TWO_FA_REQUIRED_PATH = "/app/profile/2fa-required";

/**
 * Refreshes the Supabase session on every request AND gates routes (Phase 2):
 *   - unauthenticated → /app/* redirects to /login?next=<path>
 *   - authenticated   → /login and /signup redirect to the role home
 *   - super_admin without a 2FA factor is forced to enroll (audit F-008)
 *   - the public marketing root (/) stays open to everyone
 *
 * Always uses getUser() (verifies the JWT) rather than getSession(); an expired
 * or invalid session resolves to "no user", so /app/* lands on /login instead
 * of silently failing (audit F-004).
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;
  const isAppRoute = pathname.startsWith("/app");
  const isAuthEntry = pathname === "/login" || pathname.startsWith("/signup");

  // Build a redirect that carries forward any cookies the refresh just rotated.
  const redirectTo = (path: string) => {
    const response = NextResponse.redirect(new URL(path, request.url));
    for (const cookie of supabaseResponse.cookies.getAll()) {
      response.cookies.set(cookie);
    }
    return response;
  };

  // Rewrite (URL unchanged) to a 403 page, carrying forward rotated cookies.
  const forbid = (path: string) => {
    const response = NextResponse.rewrite(new URL(path, request.url), {
      status: 403,
    });
    for (const cookie of supabaseResponse.cookies.getAll()) {
      response.cookies.set(cookie);
    }
    return response;
  };

  if (!user) {
    if (isAppRoute) {
      const next = encodeURIComponent(pathname + search);
      return redirectTo(`/login?next=${next}`);
    }
    return supabaseResponse;
  }

  // Authenticated — resolve the role from the mirrored profile row. (One small
  // query per request; revisit with a cached claim if it becomes hot.)
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  const role = profile?.role;

  if (isAuthEntry && role) {
    return redirectTo(roleHomePath(role));
  }

  // The super-admin console is gated to super_admins. Non-super_admins (and a
  // super_admin while impersonating, whose active role is the target's) get a
  // 403 "Not authorized" page — an explicit rewrite, not a redirect (audit
  // CR-4 / F-012). The admin pages/actions independently re-check via
  // requireSuperAdmin before touching the service-role client.
  if (pathname.startsWith("/app/admin") && role !== "super_admin") {
    return forbid("/not-authorized");
  }

  // The Users page, Management Hub, and the training progress dashboard are
  // team-lead surfaces, gated to team_lead and super_admin (PA-2). agent /
  // admin_tc / marketing get a 403. The pages/actions independently re-check via
  // requireTeamLead before touching the service-role client.
  if (
    (pathname.startsWith("/app/users") ||
      pathname.startsWith("/app/management") ||
      pathname.startsWith("/app/training/progress")) &&
    role !== "team_lead" &&
    role !== "super_admin"
  ) {
    return forbid("/not-authorized");
  }

  // Deals surfaces (Phase 8 / PA-7). Marketing never sees deal data
  // (F-031 / F-133); creating deals excludes super_admin because it produces
  // ambiguous ownership (F-031 — they add on-behalf-of from the company admin
  // page instead). Pages/actions re-check via the access helpers.
  if (pathname.startsWith("/app/deals")) {
    if (role === "marketing") {
      return forbid("/not-authorized");
    }
    if (pathname.startsWith("/app/deals/new") && role === "super_admin") {
      return forbid("/not-authorized");
    }
  }

  // Coaching surfaces (Phase 10 / PA-5/PA-6). Everyone on a team except
  // marketing, which has no funnel (F-031-style scoping). Pages re-check via
  // canViewCoaching; the agent variant is self-scoped in the page.
  if (pathname.startsWith("/app/coaching") && role === "marketing") {
    return forbid("/not-authorized");
  }

  // Activity Log is for producers only (agent / team_lead). admin_tc and
  // marketing have no daily prospecting funnel.
  if (
    pathname.startsWith("/app/activity-log") &&
    role !== "agent" &&
    role !== "team_lead"
  ) {
    return forbid("/not-authorized");
  }

  // Requests surfaces (Phase 9 / PA-4). Everyone may view; marketing is
  // fulfill-only and cannot create (F-136). Per-request marketing visibility
  // narrowing (F-133) is enforced in the page/queries (IDOR guard).
  if (pathname.startsWith("/app/requests/new") && role === "marketing") {
    return forbid("/not-authorized");
  }

  if (
    isAppRoute &&
    role === "super_admin" &&
    pathname !== TWO_FA_REQUIRED_PATH
  ) {
    // nextLevel === 'aal2' means a verified TOTP factor exists on the account.
    const { data: aal } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel !== "aal2") {
      return redirectTo(TWO_FA_REQUIRED_PATH);
    }
  }

  return supabaseResponse;
}
