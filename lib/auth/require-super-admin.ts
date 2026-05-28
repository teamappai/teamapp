import "server-only";
import type { User } from "@supabase/supabase-js";
import { getSessionProfile } from "@/lib/auth/profile";
import type { Profile } from "@/lib/auth/profile";

/**
 * Thrown when a non-super_admin reaches super-admin-only code. Routes are also
 * gated in middleware (which renders the 403 page), so this firing means a code
 * path was reached without the middleware gate — treat it as a hard failure.
 */
export class NotAuthorizedError extends Error {
  constructor() {
    super("Not authorized");
    this.name = "NotAuthorizedError";
  }
}

export type SuperAdminContext = { user: User; profile: Profile };

/**
 * Data-layer guard for the super-admin console. Call at the top of every admin
 * Server Component, page, and Server Action BEFORE touching the service-role
 * client (which bypasses RLS). Throws {@link NotAuthorizedError} if the caller
 * is not an authenticated super_admin.
 *
 * This is defense-in-depth: middleware already returns a 403 page for
 * `/app/admin/*` requests from non-super_admins. Note that while a super_admin
 * is impersonating another user, the active session is that user's — so this
 * correctly refuses admin access during impersonation.
 */
export async function requireSuperAdmin(): Promise<SuperAdminContext> {
  const session = await getSessionProfile();
  if (!session || session.profile.role !== "super_admin") {
    throw new NotAuthorizedError();
  }
  return { user: session.user, profile: session.profile };
}
