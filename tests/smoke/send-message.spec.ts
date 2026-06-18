import { test, expect } from "../helpers/fixtures";
import { loginAs } from "../helpers/auth";
import { clickVisible } from "../helpers/ui";

/**
 * Critical path: an agent opens an existing conversation and sends a message.
 * Exercises the three-pane Messages shell (thread list → conversation) and the
 * composer's send action on both desktop and mobile viewports.
 *
 * Picks the first direct thread (channel links live under /channels, excluded
 * here). The seed gives Agent Phil at least one DM, so a thread is always
 * present.
 */
test("agent sends a message in a conversation", async ({ page }) => {
  await loginAs(page, "agent");
  await page.goto("/app/messages");

  // Open the first direct-message thread (not a channel).
  const thread = page
    .locator('a[href^="/app/messages/"]:not([href*="/channels"])')
    .first();
  await expect(thread).toBeVisible({ timeout: 15_000 });
  await thread.click();
  await page.waitForURL(/\/app\/messages\/[0-9a-f-]{36}/, { timeout: 30_000 });

  // Compose and send a unique message.
  const body = `Smoke test message ${Date.now()}`;
  const composer = page.getByPlaceholder(/write a message/i);
  await expect(composer).toBeVisible();
  await composer.fill(body);
  await clickVisible(page.getByRole("button", { name: "Send message" }));

  // The message renders in the conversation (optimistic, then persisted).
  await expect(page.getByText(body).first()).toBeVisible({ timeout: 15_000 });
});
