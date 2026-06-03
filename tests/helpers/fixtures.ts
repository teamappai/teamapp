/* eslint-disable react-hooks/rules-of-hooks -- Playwright's fixture API requires
   the `use` callback param; it is not a React hook. */
import { test as base, expect } from "@playwright/test";

/**
 * Shared Playwright base test (Phase 15 §I3). Overrides the `page` fixture to
 * abort every request to PostHog ingest hosts (`*.i.posthog.com`) so e2e runs
 * never pollute the dev analytics project — and so a slow/blocked analytics
 * beacon can't add flake. Behaviour is otherwise identical to the stock test.
 *
 * Specs import `{ test, expect }` from here instead of `@playwright/test`.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route(/https?:\/\/[^/]*\.i\.posthog\.com\//, (route) =>
      route.abort(),
    );
    await use(page);
  },
});

export { expect };
