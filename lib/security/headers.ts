/**
 * HTTP security headers (Phase 16B, Decision 6). Applied to every route via
 * `next.config.ts` `headers()`. The Content-Security-Policy is shipped in
 * REPORT-ONLY mode so it surfaces violations in the browser console without
 * blocking anything — we can promote it to an enforcing policy once the report
 * stream is clean.
 *
 * Allow-listed external origins and WHY each is needed:
 *   - https://*.supabase.co / wss://*.supabase.co  — Supabase REST, Auth,
 *     Storage, and Realtime (websocket) for the app's database backend.
 *   - https://us.i.posthog.com                      — PostHog analytics ingest.
 *   - https://us-assets.i.posthog.com               — PostHog JS asset/array
 *     loader (posthog-js fetches its toolbar/recorder bundles from here).
 *   - https://*.ingest.us.sentry.io / *.sentry.io   — Sentry error + trace
 *     ingestion (Decision 1).
 *   - https://js.stripe.com                         — Stripe.js / Elements
 *     (script + iframe) for billing.
 *   - https://api.stripe.com                        — Stripe API calls.
 *   - https://hooks.stripe.com                      — Stripe 3DS / payment
 *     authentication iframes.
 *   - https://www.youtube.com / youtube-nocookie    — embedded training-module
 *     video blocks.
 */

const CSP_DIRECTIVES: Record<string, string[]> = {
  "default-src": ["'self'"],
  // Next.js injects inline bootstrap scripts; 'unsafe-inline'/'unsafe-eval'
  // keep framework + dev tooling from dominating the report so real
  // third-party-origin violations stand out.
  "script-src": [
    "'self'",
    "'unsafe-inline'",
    "'unsafe-eval'",
    "https://js.stripe.com",
    "https://us-assets.i.posthog.com",
  ],
  "style-src": ["'self'", "'unsafe-inline'"],
  "img-src": ["'self'", "data:", "blob:", "https:"],
  "font-src": ["'self'", "data:"],
  "connect-src": [
    "'self'",
    "https://*.supabase.co",
    "wss://*.supabase.co",
    "https://us.i.posthog.com",
    "https://us-assets.i.posthog.com",
    "https://*.ingest.us.sentry.io",
    "https://*.sentry.io",
    "https://api.stripe.com",
  ],
  "frame-src": [
    "'self'",
    "https://js.stripe.com",
    "https://hooks.stripe.com",
    "https://www.youtube.com",
    "https://www.youtube-nocookie.com",
  ],
  "worker-src": ["'self'", "blob:"],
  "object-src": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
  "frame-ancestors": ["'none'"],
};

function buildCsp(directives: Record<string, string[]>): string {
  return Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(" ")}`)
    .join("; ");
}

export const contentSecurityPolicy = buildCsp(CSP_DIRECTIVES);

export const securityHeaders: { key: string; value: string }[] = [
  {
    // HSTS: force HTTPS for 2 years, including subdomains, preload-eligible.
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    // Report-only: log violations, don't block (Decision 6).
    key: "Content-Security-Policy-Report-Only",
    value: contentSecurityPolicy,
  },
];
