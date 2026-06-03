import { test, expect } from "../helpers/fixtures";
import { loginAs } from "../helpers/auth";
import { clickVisible } from "../helpers/ui";

/**
 * Critical path: an agent creates a deal manually through the wizard
 * (start → property/client → terms → review → create). Verifies the
 * single-column form + bottom-fixed nav drive a successful submit.
 */
test("agent creates a deal via the manual wizard", async ({ page }) => {
  await loginAs(page, "agent");
  await page.goto("/app/deals/new");

  // Step 1 — choose manual entry.
  await page.getByRole("button", { name: "Enter manually" }).click();

  // Step 2 — property + client + representing.
  await page.fill("#property_address", "123 Playwright Way");
  await page.fill("#client_first_name", "Test");
  await page.fill("#client_last_name", "Buyer");
  await page.getByRole("button", { name: "Buyer", exact: true }).click();
  await clickVisible(page.getByRole("button", { name: "Continue" }));

  // Step 3 — RPA signed date is the only required term.
  await page.fill("#rpa_signed_date", "2026-06-01");
  await clickVisible(page.getByRole("button", { name: "Continue" }));

  // Step 4 — review + create.
  await clickVisible(page.getByRole("button", { name: "Create deal" }));

  await page.waitForURL(/\/app\/deals\/[0-9a-f-]{36}/, { timeout: 30_000 });
  await expect(page.getByText("123 Playwright Way").first()).toBeVisible();
});
