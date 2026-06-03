import { expect, type Page } from "@playwright/test";

export type SeedRole =
  | "super_admin"
  | "team_lead"
  | "agent"
  | "admin_tc"
  | "marketing";

/** Seed accounts (db/seed/seed.ts). All share one dev password. */
export const CREDENTIALS: Record<SeedRole, string> = {
  super_admin: "phil@teamapp.ai",
  team_lead: "phil@homereadyteam.com",
  agent: "philip.kang@homereadyteam.com",
  admin_tc: "rochie@homereadyteam.com",
  marketing: "krisha@homereadyteam.com",
};

export const SEED_PASSWORD = "DevPass!123";

/**
 * Log in through the real /login form and wait until we land somewhere inside
 * /app. super_admin is forced to /app/profile/2fa-required by middleware (no
 * seeded TOTP factor), so we wait for any /app/* route rather than a specific
 * home.
 */
export async function loginAs(page: Page, role: SeedRole): Promise<void> {
  await page.goto("/login");
  await page.fill('input[name="email"]', CREDENTIALS[role]);
  await page.fill('input[name="password"]', SEED_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/app\//, { timeout: 30_000 });
  // Sanity: we're authenticated, not bounced back to /login.
  expect(page.url()).not.toContain("/login");
}
