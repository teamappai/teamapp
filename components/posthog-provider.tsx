"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import { PostHogProvider as PostHogReactProvider } from "posthog-js/react";

import { posthogClientEnv } from "@/lib/env";

/**
 * Browser PostHog bootstrap (Phase 15, Section B). Initializes the SDK once on
 * mount and provides the singleton to the React tree via PostHog's own provider
 * so descendant client components can use `usePostHog()` / feature-flag hooks.
 *
 * Config notes:
 * - `person_profiles: 'identified_only'` — anonymous visitors don't create
 *   person profiles; only post-login `identify` does (keeps the marketing site
 *   from inflating MAU).
 * - `capture_pageview: 'history_change'` — SPA-aware pageviews on App Router
 *   navigations.
 * - `session_recording.maskAllInputs` + `maskTextSelector` — strict PII masking
 *   (Section F); message bodies / client names carry `data-ph-mask`.
 *
 * When PostHog is unconfigured (no key — dev without `.env.local`, CI), we skip
 * init entirely and just render children, so the app works without analytics.
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const env = posthogClientEnv();
    if (!env) return;
    if (posthog.__loaded) return; // guard against double-init in StrictMode

    posthog.init(env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: env.NEXT_PUBLIC_POSTHOG_HOST,
      person_profiles: "identified_only",
      capture_pageview: "history_change",
      capture_pageleave: true,
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: "[data-ph-mask]",
      },
      loaded: (ph) => {
        if (process.env.NODE_ENV === "development") ph.debug();
        // Honor the per-company session-replay kill switch
        // (flag_session_replay_enabled). Default ON; stop recording only when
        // the flag is explicitly disabled for this user's company.
        ph.onFeatureFlags((flags) => {
          if (flags.includes("flag_session_replay_enabled")) return;
          if (ph.isFeatureEnabled("flag_session_replay_enabled") === false) {
            ph.stopSessionRecording();
          }
        });
      },
    });
  }, []);

  return (
    <PostHogReactProvider client={posthog}>{children}</PostHogReactProvider>
  );
}
