import { test, expect } from "../helpers/fixtures";
import { loginAs } from "../helpers/auth";
import { clickVisible, expectToast } from "../helpers/ui";

/**
 * Critical path: an agent logs a day of activity. Exercises the daily-reset
 * form (starts at 0), a 44px stepper increment, and the submit bar.
 */
test("agent submits the daily activity log", async ({ page }) => {
  await loginAs(page, "agent");
  await page.goto("/app/activity-log");

  // Top of Funnel is open by default; bump Door Knocks via its stepper.
  const inc = page.getByRole("button", { name: "Increase Door Knocks" });
  await expect(inc).toBeVisible();
  await inc.click();
  await inc.click();

  await clickVisible(
    page.getByRole("button", { name: /(submit|update) activity/i }),
  );
  await expectToast(page);
});
