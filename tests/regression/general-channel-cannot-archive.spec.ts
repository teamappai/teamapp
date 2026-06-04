import { test, expect } from "../helpers/fixtures";
import { loginAs } from "../helpers/auth";

/**
 * Phase 11.5 regression: the #general channel is permanent — even a channel
 * admin (team_lead) gets no "Archive channel" action in its header menu.
 */
test("#general cannot be archived", async ({ page }) => {
  await loginAs(page, "team_lead");
  await page.goto("/app/messages");
  await page.waitForLoadState("networkidle");

  // Open #general from the thread list.
  await page
    .getByRole("link", { name: /general/i })
    .first()
    .click();
  await expect(page.getByRole("heading", { name: /general/i })).toBeVisible();

  // Open the channel options menu.
  await page.getByRole("button", { name: "Channel options" }).click();

  // The menu opened (info item present) but offers no archive action.
  await expect(
    page.getByRole("menuitem", { name: /view channel info/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("menuitem", { name: /archive channel/i }),
  ).toHaveCount(0);
});
