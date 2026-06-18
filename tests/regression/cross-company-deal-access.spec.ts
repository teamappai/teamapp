import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { test, expect } from "../helpers/fixtures";
import { loginAs, CREDENTIALS, SEED_PASSWORD } from "../helpers/auth";
import type { Database } from "../../types/supabase";

/**
 * Cross-company authorization regression net (Phase 16B; audit SR-3 / CR-7).
 *
 * A low-privilege agent in Company A must NEVER be able to read another
 * company's deals — not through the app, and not through the publicly exposed
 * data API (the anon Supabase key shipped to every browser, guarded only by
 * RLS). This test stands up a throwaway "Company B" with one deal via the
 * service role, then verifies every read path an attacker could try fails
 * closed.
 */

// Load .env.local into process.env (the Playwright runner doesn't do this).
for (const line of readFileSync(
  resolve(process.cwd(), ".env.local"),
  "utf8",
).split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i > 0 && !(t.slice(0, i).trim() in process.env)) {
    process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// A unique marker so we can assert it never leaks into any response/page.
const RUN = `${Date.now()}`;
const FORBIDDEN_ADDRESS = `RLS-FORBIDDEN-${RUN} Secret Lane`;
const FORBIDDEN_CLIENT = `ZZForbidden${RUN}`;

let admin: SupabaseClient<Database>;
let victimCompanyId: string;
let victimDealId: string;

test.describe.serial("cross-company deal access is denied (RLS net)", () => {
  test.beforeAll(async () => {
    admin = createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Company B — a tenant the seeded agent has no membership in.
    const { data: company, error: companyErr } = await admin
      .from("companies")
      .insert({ name: `RLS Victim Co ${RUN}`, slug: `rls-victim-${RUN}` })
      .select("id")
      .single();
    if (companyErr || !company) {
      throw new Error(`setup company: ${companyErr?.message}`);
    }
    victimCompanyId = company.id;

    // A deal that belongs solely to Company B.
    const { data: deal, error: dealErr } = await admin
      .from("deals")
      .insert({
        company_id: victimCompanyId,
        property_address: FORBIDDEN_ADDRESS,
        client_first_name: FORBIDDEN_CLIENT,
        client_last_name: "Victim",
        representing: "seller",
        is_draft: false,
      })
      .select("id")
      .single();
    if (dealErr || !deal) throw new Error(`setup deal: ${dealErr?.message}`);
    victimDealId = deal.id;
  });

  test.afterAll(async () => {
    if (!admin) return;
    if (victimDealId) await admin.from("deals").delete().eq("id", victimDealId);
    if (victimCompanyId) {
      await admin.from("companies").delete().eq("id", victimCompanyId);
    }
  });

  test("via the app: agent cannot open another company's deal detail", async ({
    page,
  }) => {
    await loginAs(page, "agent");

    await page.goto(`/app/deals/${victimDealId}`);

    // No fragment of Company B's deal may render.
    await expect(page.locator("body")).not.toContainText(FORBIDDEN_ADDRESS);
    await expect(page.locator("body")).not.toContainText(FORBIDDEN_CLIENT);
    // getDealById is RLS-scoped → returns nothing → Next renders notFound().
    await expect(page.locator("body")).toContainText(/not found/i);
  });

  test("via the app: another company's deal is absent from the list", async ({
    page,
  }) => {
    await loginAs(page, "agent");
    await page.goto("/app/deals");
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("body")).not.toContainText(FORBIDDEN_ADDRESS);
    await expect(page.locator("body")).not.toContainText(FORBIDDEN_CLIENT);
  });

  test("via the public data API: anon key + agent session returns no rows", async () => {
    // Exactly what an attacker with a stolen agent session could run from a
    // browser console: the anon key + the agent's JWT, hitting PostgREST.
    const anon = createClient<Database>(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: signInErr } = await anon.auth.signInWithPassword({
      email: CREDENTIALS.agent,
      password: SEED_PASSWORD,
    });
    expect(signInErr, signInErr?.message).toBeNull();

    // Direct lookup of Company B's deal by id → blocked by RLS (zero rows).
    const { data: byId } = await anon
      .from("deals")
      .select("id, property_address, client_first_name")
      .eq("id", victimDealId);
    expect(byId ?? []).toHaveLength(0);

    // Broad scan of every deal the agent can see → must not include Company B's.
    const { data: all } = await anon
      .from("deals")
      .select("id, property_address");
    const ids = (all ?? []).map((d) => d.id);
    expect(ids).not.toContain(victimDealId);
    const addresses = (all ?? []).map((d) => d.property_address);
    expect(addresses).not.toContain(FORBIDDEN_ADDRESS);

    await anon.auth.signOut();
  });

  test("via an app API route: /api/deals/extract does not leak a foreign deal", async ({
    page,
  }) => {
    await loginAs(page, "agent");

    // The agent's session cookies ride along with page.request. Reference the
    // foreign deal id; the route's RLS-scoped lookup must fail closed.
    const res = await page.request.post("/api/deals/extract", {
      data: { dealFileId: victimDealId },
    });
    expect(res.status()).not.toBe(200);
    const body = await res.text();
    expect(body).not.toContain(FORBIDDEN_ADDRESS);
    expect(body).not.toContain(FORBIDDEN_CLIENT);
  });
});
