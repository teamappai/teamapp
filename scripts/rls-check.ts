/**
 * RLS behavioral spot-check. Signs in as each seeded role using the ANON key
 * (so RLS applies exactly as it would for a real client) and asserts each role
 * sees what it should. Run after seeding:  pnpm exec tsx scripts/rls-check.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

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

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const PASSWORD = "DevPass!123";

let failures = 0;
function check(label: string, actual: number, expected: number) {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}: ${actual} (expected ${expected})`);
}

async function asUser(email: string) {
  const c = createClient<Database>(URL, ANON, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await c.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (error) throw new Error(`sign-in ${email}: ${error.message}`);
  return c;
}

async function countRows(
  c: Awaited<ReturnType<typeof asUser>>,
  table:
    | "users"
    | "deals"
    | "training_sections"
    | "companies"
    | "coaching_log_entries",
) {
  const { count, error } = await c
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) throw new Error(`${table}: ${error.message}`);
  return count ?? 0;
}

async function main() {
  console.log("RLS spot-check (anon key + password sign-in)\n");

  console.log("super_admin (phil@teamapp.ai):");
  const sa = await asUser("phil@teamapp.ai");
  check("sees all users", await countRows(sa, "users"), 5);
  check("sees all companies", await countRows(sa, "companies"), 1);

  console.log("team_lead (phil@homereadyteam.com):");
  const tl = await asUser("phil@homereadyteam.com");
  check("sees company members", await countRows(tl, "users"), 4);
  check("sees all company deals", await countRows(tl, "deals"), 5);
  check(
    "manages all company sections",
    await countRows(tl, "training_sections"),
    3,
  );

  console.log("agent (philip.kang@homereadyteam.com):");
  const ag = await asUser("philip.kang@homereadyteam.com");
  check("sees company members", await countRows(ag, "users"), 4);
  check("sees company deals", await countRows(ag, "deals"), 5);
  check(
    "sees only role-visible sections (Onboarding + Agent)",
    await countRows(ag, "training_sections"),
    2,
  );
  check(
    "sees coaching entry about self",
    await countRows(ag, "coaching_log_entries"),
    1,
  );

  console.log("admin_tc (rochie@homereadyteam.com):");
  const tc = await asUser("rochie@homereadyteam.com");
  check(
    "sees Onboarding + Ops&Marketing sections",
    await countRows(tc, "training_sections"),
    2,
  );

  console.log("marketing (krisha@homereadyteam.com):");
  const mk = await asUser("krisha@homereadyteam.com");
  check(
    "sees Onboarding + Ops&Marketing sections",
    await countRows(mk, "training_sections"),
    2,
  );

  console.log(
    `\n${failures === 0 ? "ALL CHECKS PASSED ✓" : `${failures} CHECK(S) FAILED ✗`}`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
