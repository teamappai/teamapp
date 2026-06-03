import { defineConfig, devices } from "@playwright/test";

/**
 * Phase 14 E2E + a11y suite. Runs every spec on two viewports — desktop
 * (1440×900) and iPhone SE (375×667) — so the mobile pass is regression-tested
 * on the same critical paths as desktop. The dev server is started once and
 * reused locally; CI always starts a fresh one.
 */
export default defineConfig({
  testDir: "./tests",
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
