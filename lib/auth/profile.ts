import "server-only";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

export type Profile = Database["public"]["Tables"]["users"]["Row"];

export type SessionProfile = {
  user: User;
  profile: Profile;
  /** The user's company name, when they belong to one (null for super_admin). */
  companyName: string | null;
};

/**
 * Resolve the authenticated user and their mirrored `public.users` profile.
 * Returns null when there is no valid session, or when the auth user has no
 * profile row yet. Always uses `getUser()` (verifies the JWT) — never
 * `getSession()` — for any decision that gates access.
 */
export async function getSessionProfile(): Promise<SessionProfile | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();
  if (!profile) return null;

  let companyName: string | null = null;
  if (profile.company_id) {
    const { data: company } = await supabase
      .from("companies")
      .select("name")
      .eq("id", profile.company_id)
      .single();
    companyName = company?.name ?? null;
  }

  return { user, profile, companyName };
}
