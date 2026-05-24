import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Wordmark } from "@/components/shared/wordmark";

const MARKETING_URL =
  process.env.NEXT_PUBLIC_MARKETING_URL ?? "https://teamapp.ai";

/**
 * Shared chrome for the four auth pages: a centered card with the TeamApp
 * wordmark, a link back to the marketing site, and the legal footer. This is
 * the ONLY place the legal footer appears — the authenticated app shell has no
 * footer (audit F-007).
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-muted/40 flex min-h-screen flex-col">
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-6 flex flex-col items-center gap-3">
            <Wordmark href={MARKETING_URL} className="text-2xl" />
            <Link
              href={MARKETING_URL}
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
            >
              <ArrowLeft className="size-3.5" />
              Back to teamapp.ai
            </Link>
          </div>
          {children}
        </div>
      </div>

      <footer className="border-t py-6">
        <div className="text-muted-foreground mx-auto flex max-w-md flex-col items-center gap-2 px-4 text-center text-xs">
          <p>&copy; {new Date().getFullYear()} TeamApp. All rights reserved.</p>
          <nav className="flex items-center gap-4">
            <Link
              href={`${MARKETING_URL}/privacy`}
              className="hover:text-foreground"
            >
              Privacy
            </Link>
            <Link
              href={`${MARKETING_URL}/terms`}
              className="hover:text-foreground"
            >
              Terms
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
