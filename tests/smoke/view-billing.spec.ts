import { test, expect } from "../helpers/fixtures";
import { loginAs } from "../helpers/auth";

/**
 * Critical path: a team lead opens the Billing dashboard. Confirms the page
 * loads its plan/seat overview without requiring a live Stripe connection (the
 * billing state helpers no-op when no Stripe customer is configured, so this is
 * safe to run against the staging project).
 */
test("team lead can view the billing dashboard", async ({ page }) => {
  await loginAs(page, "team_lead");
  await page.goto("/app/billing");

  await expect(page.getByRole("heading", { name: "Billing" })).toBeVisible();
  // The overview surfaces seat usage and the plan tabs.
  await expect(page.getByRole("tab", { name: "Plans" })).toBeVisible();
  await expect(page.getByText("Seats used", { exact: true })).toBeVisible();
  expect(page.url()).toContain("/app/billing");
});
