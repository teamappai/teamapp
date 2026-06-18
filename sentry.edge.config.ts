// Sentry edge runtime initialization (Phase 16B, Decision 1). Loaded by
// instrumentation.ts when NEXT_RUNTIME === "edge" (middleware, edge routes).
import * as Sentry from "@sentry/nextjs";
import { baseSentryOptions } from "@/lib/sentry/options";

Sentry.init({
  ...baseSentryOptions,
});
