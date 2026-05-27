import type { Metadata } from "next";

/**
 * Shared configuration for the public marketing site: canonical URL, nav/footer
 * link maps, and a small `pageMetadata` helper that builds per-page SEO tags
 * (title, description, canonical, Open Graph, Twitter) on top of sensible
 * defaults. Every marketing page calls `pageMetadata` from `generateMetadata`.
 */

export const SITE_NAME = "TeamApp";

/** Public marketing origin. Combined-domain topology: marketing at `/`, app at
 * `/app/*` on the same host. Falls back to the production domain in prod builds. */
export const SITE_URL =
  process.env.NEXT_PUBLIC_MARKETING_URL ?? "https://teamapp.ai";

export const SITE_TAGLINE = "The OS for high-performing real estate teams.";

export const SITE_DESCRIPTION =
  "TeamApp centralizes your team's operational data so you can train better, coach smarter, and unlock AI workflows.";

/** Default social-share image. TODO: replace placeholder with a real 1200×630 OG image. */
export const OG_IMAGE = "/opengraph-image.png";

export const NAV_LINKS: { href: string; label: string }[] = [
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/for-team-leads", label: "For Team Leads" },
  { href: "/for-agents", label: "For Agents" },
];

export const FOOTER_SECTIONS: {
  heading: string;
  links: { href: string; label: string; external?: boolean }[];
}[] = [
  {
    heading: "Product",
    links: [
      { href: "/features", label: "Features" },
      { href: "/pricing", label: "Pricing" },
      { href: "/demo", label: "Book a demo" },
    ],
  },
  {
    heading: "Solutions",
    links: [
      { href: "/for-team-leads", label: "For Team Leads" },
      { href: "/for-agents", label: "For Agents" },
    ],
  },
  {
    heading: "Company",
    links: [
      { href: "/security", label: "Security" },
      { href: "/contact", label: "Contact" },
      { href: "/login", label: "Log in" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
    ],
  },
];

export const SOCIAL_LINKS: { href: string; label: string }[] = [
  // TODO: confirm real social handles before launch.
  { href: "https://www.linkedin.com/company/teamapp", label: "LinkedIn" },
  { href: "https://x.com/teamapp", label: "X" },
];

/** Calendly booking URL used by /demo. TODO: confirm the real Calendly link. */
export const DEMO_CALENDLY_URL =
  "https://calendly.com/phil-teamapp/teamapp-demo";

type PageMetaInput = {
  title: string;
  description?: string;
  /** Path relative to SITE_URL, e.g. "/pricing". Defaults to "/". */
  path?: string;
};

/**
 * Build per-page metadata: a templated title, description, canonical URL, and
 * matching Open Graph / Twitter card tags. Root `metadataBase` (set in the root
 * layout) resolves the relative OG image to an absolute URL.
 */
export function pageMetadata({
  title,
  description = SITE_DESCRIPTION,
  path = "/",
}: PageMetaInput): Metadata {
  const url = new URL(path, SITE_URL).toString();
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title,
      description,
      url,
      images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: SITE_NAME }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [OG_IMAGE],
    },
  };
}
