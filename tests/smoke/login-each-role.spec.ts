import { test, expect } from "../helpers/fixtures";
import { loginAs, CREDENTIALS, SEED_PASSWORD } from "../helpers/auth";

/**
 * One smoke test per seed role: log in and confirm we reach the authenticated
 * app shell. super_admin has 2FA enforced (audit F-008), so its credentials are
 * accepted into either a TOTP challenge or the 2FA-setup screen — both prove
 * the password was accepted; neither lands on a dashboard.
 */
for (const role of ["team_lead", "agent", "admin_tc", "marketing"] as const) {
  test(`login as ${role} reaches the app`, async ({ page }) => {
    await loginAs(page, role);
    expect(page.url()).toContain("/app/");
    await expect(page.locator("#main-content")).toBeVisible();
  });
}

test("login as super_admin is accepted (2FA-gated)", async ({ page }) => {
  await page.goto("/login");
  await page.fill('input[name="email"]', CREDENTIALS.super_admin);
  await page.fill('input[name="password"]', SEED_PASSWORD);
  await page.click('button[type="submit"]');

  // Either a TOTP challenge appears, or middleware routes to the 2FA-setup
  // page — both confirm the credentials were accepted without an error.
  await expect
    .poll(
      async () => {
        if (/\/app\//.test(page.url())) return "in-app";
        if (
          await page
            .getByText("Two-factor code")
            .isVisible()
            .catch(() => false)
        )
          return "mfa";
        return "pending";
      },
      { timeout: 30_000 },
    )
    .not.toBe("pending");

  // And we never surfaced an "incorrect email or password" error.
  await expect(page.getByText(/incorrect email or password/i)).toHaveCount(0);
});
