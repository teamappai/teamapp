import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit/log";
import {
  IMPERSONATION_ADMIN_ID_COOKIE,
  IMPERSONATION_SESSION_COOKIE,
  verifyValue,
  decodeSessionTokens,
} from "@/lib/auth/impersonation";

/**
 * Ends an impersonation session and restores the original admin (audit CR-4).
 * The signed `impersonation_admin_id` cookie authenticates this request — the
 * impersonated user cannot forge it — so we trust it rather than the (currently
 * impersonated) session. POST-only so it can't fire on a prefetch.
 */
export async function POST(request: NextRequest) {
  const adminId = verifyValue(
    request.cookies.get(IMPERSONATION_ADMIN_ID_COOKIE)?.value,
  );
  const tokens = decodeSessionTokens(
    request.cookies.get(IMPERSONATION_SESSION_COOKIE)?.value,
  );

  // No valid impersonation context — nothing to restore.
  if (!adminId) {
    return NextResponse.redirect(new URL("/app/dashboard", request.url), {
      status: 303,
    });
  }

  const supabase = await createClient();

  // Capture who we were impersonating for the audit trail before restoring.
  const {
    data: { user: current },
  } = await supabase.auth.getUser();

  await logAudit({
    actor_user_id: adminId,
    action: "impersonate_ended",
    resource_type: "user",
    resource_id: current?.id ?? null,
    metadata: { impersonated_user_id: current?.id ?? null },
  });

  let restored = false;
  if (tokens) {
    const { error } = await supabase.auth.setSession({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    });
    restored = !error;
  }

  // Fallback: mint a fresh session for the admin via magic link. (This lands at
  // aal1, so the super_admin 2FA gate will prompt re-verification.)
  if (!restored) {
    const service = createServiceClient();
    const { data: admin } = await service
      .from("users")
      .select("email")
      .eq("id", adminId)
      .maybeSingle();
    if (admin?.email) {
      const { data: link } = await service.auth.admin.generateLink({
        type: "magiclink",
        email: admin.email,
      });
      const tokenHash = link?.properties?.hashed_token;
      if (tokenHash) {
        await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "magiclink",
        });
      }
    }
  }

  // Clear the impersonation cookies via the same next/headers store the auth
  // client wrote the restored session to, so all mutations land on the response.
  const cookieStore = await cookies();
  cookieStore.delete(IMPERSONATION_ADMIN_ID_COOKIE);
  cookieStore.delete(IMPERSONATION_SESSION_COOKIE);

  return NextResponse.redirect(new URL("/app/admin", request.url), {
    status: 303,
  });
}
