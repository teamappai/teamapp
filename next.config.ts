import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import { securityHeaders } from "./lib/security/headers";

const nextConfig: NextConfig = {
  // HTTP security headers (Phase 16B, Decision 6). CSP is report-only.
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

// Source-map upload requires the auth token PLUS the org/project slugs (the DSN
// alone can't be turned into upload targets). We gate on all three so a build
// with incomplete credentials still succeeds — uploads simply switch on once
// SENTRY_ORG and SENTRY_PROJECT are set alongside SENTRY_AUTH_TOKEN.
const sourceMapsConfigured = !!(
  process.env.SENTRY_AUTH_TOKEN &&
  process.env.SENTRY_ORG &&
  process.env.SENTRY_PROJECT
);

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Upload source maps at build time (Decision 1) when fully configured.
  sourcemaps: { disable: !sourceMapsConfigured },
  // Hide generated source maps from the public client bundle after upload.
  widenClientFileUpload: true,
  // Keep CI/build logs quiet and don't phone home with build telemetry.
  silent: !process.env.CI,
  telemetry: false,
});
