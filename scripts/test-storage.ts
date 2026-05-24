/**
 * Storage RLS test. Uploads as different seeded users via the ANON key to prove
 * the bucket policies (migration 0015) allow the right writes and deny the rest.
 * Run after seeding:  pnpm exec tsx scripts/test-storage.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASSWORD = "DevPass!123";
const BLOB = new Blob(["teamapp storage test"], { type: "text/plain" });

const service = createClient<Database>(URL, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let failures = 0;
type Result = { error: unknown };
async function expect(
  label: string,
  want: "allow" | "deny",
  op: Promise<Result>,
) {
  const { error } = await op;
  const got = error ? "deny" : "allow";
  const ok = got === want;
  if (!ok) failures++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}: ${got} (expected ${want})`);
}

async function signIn(email: string): Promise<SupabaseClient<Database>> {
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

async function userId(email: string): Promise<string> {
  const { data, error } = await service
    .from("users")
    .select("id")
    .eq("email", email)
    .single();
  if (error) throw error;
  return data.id;
}

const rnd = () => `${crypto.randomUUID()}.txt`;
const FOREIGN_COMPANY = crypto.randomUUID();
const cleanup: Array<{ bucket: string; path: string }> = [];

async function up(c: SupabaseClient<Database>, bucket: string, path: string) {
  const res = await c.storage.from(bucket).upload(path, BLOB);
  if (!res.error) cleanup.push({ bucket, path });
  return res;
}

async function main() {
  console.log("Storage RLS test\n");

  const { data: company } = await service
    .from("companies")
    .select("id")
    .eq("slug", "homeready-team")
    .single();
  const companyId = company!.id;
  const { data: deal } = await service
    .from("deals")
    .select("id")
    .eq("company_id", companyId)
    .limit(1)
    .single();
  const dealId = deal!.id;

  const agentId = await userId("philip.kang@homereadyteam.com");
  const marketingId = await userId("krisha@homereadyteam.com");

  // A thread the agent participates in (for message-attachments).
  const { data: thread } = await service
    .from("message_threads")
    .insert({
      company_id: companyId,
      type: "group",
      name: "storage-test",
      created_by: agentId,
    })
    .select("id")
    .single();
  const threadId = thread!.id;
  await service
    .from("message_thread_participants")
    .insert({ thread_id: threadId, user_id: agentId });

  const agent = await signIn("philip.kang@homereadyteam.com");
  const teamLead = await signIn("phil@homereadyteam.com");
  const marketing = await signIn("krisha@homereadyteam.com");

  console.log("deal-files (private, same-company):");
  await expect(
    "agent -> own company deal",
    "allow",
    up(agent, "deal-files", `${companyId}/${dealId}/${rnd()}`),
  );
  await expect(
    "agent -> foreign company",
    "deny",
    up(agent, "deal-files", `${FOREIGN_COMPANY}/${dealId}/${rnd()}`),
  );

  console.log("avatars (public read, own-uid write):");
  await expect(
    "agent -> own uid",
    "allow",
    up(agent, "avatars", `${agentId}/${rnd()}`),
  );
  await expect(
    "agent -> another uid",
    "deny",
    up(agent, "avatars", `${marketingId}/${rnd()}`),
  );

  console.log("company-logos (team_lead only):");
  await expect(
    "agent (not manager)",
    "deny",
    up(agent, "company-logos", `${companyId}/${rnd()}`),
  );
  await expect(
    "team_lead",
    "allow",
    up(teamLead, "company-logos", `${companyId}/${rnd()}`),
  );

  console.log("message-attachments (participants only):");
  await expect(
    "agent (participant)",
    "allow",
    up(agent, "message-attachments", `${companyId}/${threadId}/${rnd()}`),
  );
  await expect(
    "marketing (non-participant)",
    "deny",
    up(marketing, "message-attachments", `${companyId}/${threadId}/${rnd()}`),
  );

  // cleanup
  for (const { bucket, path } of cleanup)
    await service.storage.from(bucket).remove([path]);
  await service.from("message_threads").delete().eq("id", threadId);

  console.log(
    `\n${failures === 0 ? "ALL STORAGE CHECKS PASSED ✓" : `${failures} CHECK(S) FAILED ✗`}`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
