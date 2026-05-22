import "client-only";
import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client (anon key). Use only in Client Components.
 * The `client-only` import makes importing this from a Server Component
 * fail at build time with a clear error.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
