import Link from "next/link";

import { FOOTER_SECTIONS, SITE_NAME, SOCIAL_LINKS } from "@/lib/marketing/site";
import { Wordmark } from "@/components/shared/wordmark";

/**
 * Public marketing footer: brand blurb, a site map grouped by section, social
 * links, and the legal line. This footer renders ONLY on marketing routes — the
 * authenticated app shell has no footer (audit F-007).
 */
export function MarketingFooter() {
  return (
    <footer className="bg-muted/30 border-t">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[1.5fr_repeat(4,1fr)]">
          <div className="space-y-3">
            <Wordmark />
            <p className="text-muted-foreground max-w-xs text-sm">
              The operating system for high-performing real estate teams.
            </p>
            <ul className="flex gap-4 pt-1">
              {SOCIAL_LINKS.map((social) => (
                <li key={social.href}>
                  <a
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                  >
                    {social.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {FOOTER_SECTIONS.map((section) => (
            <nav key={section.heading} aria-label={section.heading}>
              <h2 className="text-foreground mb-3 text-sm font-semibold">
                {section.heading}
              </h2>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={`${section.heading}-${link.href}`}>
                    <Link
                      href={link.href}
                      className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="text-muted-foreground mt-10 border-t pt-6 text-xs">
          <p>
            &copy; {new Date().getFullYear()} {SITE_NAME}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
