import { defineConfig, devices } from "@playwright/test";

/**
 * Phase 14 E2E + a11y suite. Runs every spec on two viewports — desktop
 * (1440×900) and iPhone SE (375×667) — so the mobile pass is regression-tested
 * on the same critical paths as desktop. The dev server is started once and
 * reused locally; CI always starts a fresh one.
 *
 * PostHog (Phase 15): specs import `{ test, expect }` from
 * `tests/helpers/fixtures.ts`, whose `page` fixture aborts all `*.i.posthog.com`
 * requests so e2e runs never emit analytics events. (Playwright has no
 * config-level request routing, so this lives in the shared base test.)
 */
export default defineConfig({
  testDir: "./tests",
  // Playwright's default testMatch also catches *.test.ts — restrict it to
  // *.spec.ts so the vitest suite under tests/posthog/ isn't run here.
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [["github"], ["list"], ["html", { open: "never" }]]
    : [["list"]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      // iPhone SE dimensions on Chromium (we only install chromium in CI/local;
      // the WebKit "iPhone SE" descriptor would need a separate browser).
      name: "mobile-iphone-se",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 375, height: 667 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: "pnpm dev",
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
