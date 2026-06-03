import { test, expect } from "@playwright/test";
import { loginAs } from "../helpers/auth";

/**
 * F-133 regression: marketing must never see deal events. The marketing
 * dashboard activity feed hides the "Deals" filter entirely and no feed item
 * links into /app/deals.
 */
test("marketing dashboard feed contains zero deal events", async ({ page }) => {
  await loginAs(page, "marketing");
  await page.goto("/app/dashboard");
  await page.waitForLoadState("networkidle");

  // The "Deals" category filter is not offered to marketing.
  await expect(
    page.getByRole("button", { name: "Deals", exact: true }),
  ).toHaveCount(0);

  // No activity-feed row links to a deal.
  await expect(page.locator('a[href^="/app/deals"]')).toHaveCount(0);
});
