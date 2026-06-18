// Sentry client (browser) initialization (Phase 16B, Decision 1). Next.js
// (>=15.3) loads this file natively in the browser bundle, so client error
// reporting works independently of the build-time Sentry webpack plugin.
import * as Sentry from "@sentry/nextjs";
import { baseSentryOptions } from "@/lib/sentry/options";

Sentry.init({
  ...baseSentryOptions,
});

// Instrument App Router navigations so client-side route changes are traced.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
