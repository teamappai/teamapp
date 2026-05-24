import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/profile";
import { roleHomePath } from "@/lib/constants/roles";
import { Wordmark } from "@/components/shared/wordmark";
import { Button } from "@/components/ui/button";

/**
 * Authenticated app shell. Phase 2 keeps this deliberately minimal — no sidebar
 * nav (Phase 3) and, importantly, no legal footer (audit F-007: the footer
 * belongs only on the auth pages). Just a slim top bar with the wordmark, a
 * profile link, and logout.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Middleware already gates /app/*; this is defense-in-depth and gives us the
  // role for the home link.
  const session = await getSessionProfile();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Wordmark href={roleHomePath(session.profile.role)} />
          <nav className="flex items-center gap-1">
            <Button asChild variant="ghost" size="sm">
              <Link href="/app/profile">Profile</Link>
            </Button>
            <form action="/logout" method="post">
              <Button type="submit" variant="ghost" size="sm">
                Log out
              </Button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
