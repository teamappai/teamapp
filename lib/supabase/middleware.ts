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
