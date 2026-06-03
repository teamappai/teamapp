import { test, expect } from "../helpers/fixtures";
import { CREDENTIALS, SEED_PASSWORD } from "../helpers/auth";

/**
 * SR-4 regression: the same credentials that work on desktop must work on a
 * phone. The historical Bubble bug was mobile keyboards autocapitalizing the
 * email and case-sensitive auth rejecting it. We (1) force a 375px viewport,
 * (2) assert the email input carries the hardening attributes, and (3) submit
 * an UPPERCASED, space-padded email and confirm login still succeeds (the
 * schema trims + lowercases server-side).
 */
test.describe("SR-4 mobile login", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("email input has mobile-hardening attributes", async ({ page }) => {
    await page.goto("/login");
    const email = page.locator('input[name="email"]');
    await expect(email).toHaveAttribute("inputmode", "email");
    await expect(email).toHaveAttribute("autocapitalize", "none");
    await expect(email).toHaveAttribute("autocorrect", "off");
    await expect(email).toHaveAttribute("autocomplete", "email");
  });

  test("login succeeds with uppercased / padded email at 375px", async ({
    page,
  }) => {
    const messy = `  ${CREDENTIALS.agent.toUpperCase()}  `;
    await page.goto("/login");
    await page.fill('input[name="email"]', messy);
    await page.fill('input[name="password"]', SEED_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/app\//, { timeout: 30_000 });
    expect(page.url()).not.toContain("/login");
  });
});
