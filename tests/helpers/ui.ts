import { type Locator, type Page, expect } from "@playwright/test";

/**
 * Several screens render duplicate desktop + mobile copies of an action button
 * (one hidden per breakpoint). Click whichever copy is actually visible so the
 * same test works on both projects.
 */
export async function clickVisible(locator: Locator): Promise<void> {
  const n = await locator.count();
  for (let i = 0; i < n; i++) {
    const candidate = locator.nth(i);
    if (await candidate.isVisible()) {
      await candidate.click();
      return;
    }
  }
  throw new Error("clickVisible: no visible element matched");
}

/** Wait for a Sonner toast to appear (success/info/error all share the slot). */
export async function expectToast(page: Page, text?: RegExp): Promise<void> {
  const toast = page.locator("[data-sonner-toast]");
  await expect(toast.first()).toBeVisible({ timeout: 15_000 });
  if (text) await expect(toast.first()).toContainText(text);
}
