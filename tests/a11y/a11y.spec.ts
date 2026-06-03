import { test, expect } from "../helpers/fixtures";
import AxeBuilder from "@axe-core/playwright";
import { loginAs, type SeedRole } from "../helpers/auth";

/**
 * Automated WCAG 2.1 A/AA audit (Phase 14, Decision 6). We gate on CRITICAL
 * violations being zero on every critical-path route; serious/moderate issues
 * are logged for triage but don't fail the build.
 */
const ROUTES: Array<{ path: string; auth: SeedRole | null }> = [
  { path: "/login", auth: null },
  { path: "/app/dashboard", auth: "team_lead" },
  { path: "/app/activity-log", auth: "agent" },
  { path: "/app/deals", auth: "team_lead" },
  { path: "/app/deals/new", auth: "agent" },
  { path: "/app/messages", auth: "team_lead" },
  { path: "/app/coaching", auth: "team_lead" },
  { path: "/app/training", auth: "agent" },
  { path: "/app/playbooks", auth: "team_lead" },
];

for (const route of ROUTES) {
  test(`a11y: ${route.path} has no critical violations`, async ({ page }) => {
    if (route.auth) await loginAs(page, route.auth);
    await page.goto(route.path);
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    const critical = results.violations.filter((v) => v.impact === "critical");
    const serious = results.violations.filter((v) => v.impact === "serious");
    if (serious.length > 0) {
      console.log(
        `[a11y] ${route.path} serious issues (non-blocking):`,
        serious.map((v) => `${v.id} (${v.nodes.length})`).join(", "),
      );
      if (process.env.AXE_DEBUG) {
        for (const v of serious) {
          for (const n of v.nodes) {
            const data = n.any?.[0]?.data as
              | { contrastRatio?: number; fgColor?: string; bgColor?: string }
              | undefined;
            const c = data
              ? ` ratio=${data.contrastRatio} fg=${data.fgColor} bg=${data.bgColor}`
              : "";
            console.log(`  [${v.id}]${c} :: ${n.html.slice(0, 90)}`);
          }
        }
      }
    }
    expect(
      critical,
      critical.map((v) => `${v.id}: ${v.help}`).join("\n"),
    ).toHaveLength(0);
  });
}
