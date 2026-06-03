"use client";

import { useEffect } from "react";
import posthog from "@/lib/posthog/client";
import {
  identifyUser,
  identifyCompany,
  type IdentifyUserInput,
  type IdentifyCompanyInput,
} from "@/lib/posthog/identify";

/**
 * Cross-boundary identify (Phase 15, Decision 6: login + hydration). The server
 * resolves the authenticated user + company shape and renders this client
 * component inside the authenticated shell. On mount we (re-)identify if the
 * PostHog distinct_id doesn't already match the user — this catches both fresh
 * logins AND users arriving on a refreshed session (where the login action
 * never ran), without re-sending identify on every navigation.
 */
export function Identify({
  user,
  company,
}: {
  user: IdentifyUserInput;
  company: IdentifyCompanyInput | null;
}) {
  useEffect(() => {
    // Only identify once PostHog has loaded and the identity actually differs.
    if (!posthog.__loaded) {
      // init runs in a sibling provider's effect; defer one tick.
      const id = setTimeout(() => {
        if (posthog.get_distinct_id?.() !== user.id) {
          identifyUser(user);
          if (company) identifyCompany(company);
        }
      }, 0);
      return () => clearTimeout(id);
    }
    if (posthog.get_distinct_id?.() !== user.id) {
      identifyUser(user);
      if (company) identifyCompany(company);
    }
  }, [user, company]);

  return null;
}
