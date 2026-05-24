import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/types/supabase";

export type Invitation =
  Database["public"]["Tables"]["user_invitations"]["Row"];

export type InvitationLookup =
  | { ok: true; invitation: Invitation }
  | { ok: false; reason: "missing" | "accepted" | "expired" };

/**
 * Look up an invitation by its token and report whether it is usable. Reads
 * with the service-role client because unauthenticated visitors cannot satisfy
 * the `user_invitations` RLS policy (which requires company management rights).
 */
export async function getInvitationByToken(
  token: string | null | undefined,
): Promise<InvitationLookup> {
  if (!token) return { ok: false, reason: "missing" };

  const service = createServiceClient();
  const { data: invitation } = await service
    .from("user_invitations")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (!invitation) return { ok: false, reason: "missing" };
  if (invitation.accepted_at) return { ok: false, reason: "accepted" };
  if (new Date(invitation.expires_at).getTime() <= Date.now()) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true, invitation };
}
