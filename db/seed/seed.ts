/**
 * TeamApp local seed script.
 *
 * Creates the five canonical test accounts + a demo company and sample data so
 * the app can be exercised locally against the real Supabase project. Uses the
 * SERVICE ROLE key, which bypasses RLS — never ship this key to the client.
 *
 * Run with:  pnpm db:seed
 * Idempotent: re-running finds-or-creates auth users by email, upserts the
 * company by slug, and clears the demo company's sample data before reinserting.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/supabase";
import { getPlan, type PlanId } from "../../lib/billing/plans";

type Tables = Database["public"]["Tables"];
type UserRole = Database["public"]["Enums"]["user_role"];

const PASSWORD = "DevPass!123";
const COMPANY_SLUG = "homeready-team";
// HomeReady demo company plan. Seat count is derived from plans.ts — never
// hardcode seat numbers here (pricing source of truth: lib/billing/plans.ts).
const COMPANY_PLAN: PlanId = "pro";

// ── env loading ───────────────────────────────────────────────────────────────
function loadEnvLocal(): void {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // No .env.local — rely on the ambient environment.
  }
}

loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
      "Fill them in .env.local before seeding.",
  );
  process.exit(1);
}

const admin: SupabaseClient<Database> = createClient<Database>(
  SUPABASE_URL,
  SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

function die(context: string, error: { message: string } | null): void {
  if (error) {
    console.error(`\n✗ ${context}: ${error.message}`);
    process.exit(1);
  }
}

// ── auth users ──────────────────────────────────────────────────────────────
async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  // Fresh projects have few users; one large page is plenty for a seed.
  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  die("listUsers", error);
  const match = data.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  );
  return match?.id ?? null;
}

async function ensureAuthUser(
  email: string,
  fullName: string,
  role: UserRole,
): Promise<string> {
  const existingId = await findAuthUserIdByEmail(email);
  if (existingId) {
    await admin.auth.admin.updateUserById(existingId, {
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: fullName, role },
    });
    return existingId;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName, role },
  });
  die(`createUser ${email}`, error);
  return data.user!.id;
}

async function upsertProfile(row: Tables["users"]["Insert"]): Promise<void> {
  const { error } = await admin.from("users").upsert(row, { onConflict: "id" });
  die(`upsert profile ${row.email}`, error);
}

// ── helpers ───────────────────────────────────────────────────────────────────
function moduleContent(
  title: string,
): Database["public"]["Tables"]["training_modules"]["Insert"]["content"] {
  return [
    { type: "heading", level: 1, text: title },
    {
      type: "paragraph",
      text: "Welcome to this module. Work through the material below.",
    },
    {
      type: "video_embed",
      provider: "youtube",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    },
    {
      type: "link",
      url: "https://example.com/resource",
      label: "Supplementary resource",
    },
    { type: "callout", variant: "tip", text: "Pro tip: take notes as you go." },
  ];
}

function daysAgoDate(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  console.log("Seeding TeamApp …\n");

  // 1) super_admin (company_id MUST be null per users_company_scope_ck).
  const superAdminId = await ensureAuthUser(
    "phil@teamapp.ai",
    "Philip Kang SA",
    "super_admin",
  );
  await upsertProfile({
    id: superAdminId,
    company_id: null,
    email: "phil@teamapp.ai",
    full_name: "Philip Kang SA",
    role: "super_admin",
    status: "active",
    last_active_at: new Date().toISOString(),
  });

  // 2) company — seat count comes from the canonical plan, not a literal.
  const plan = getPlan(COMPANY_PLAN);
  const { data: company, error: companyErr } = await admin
    .from("companies")
    .upsert(
      {
        name: "HomeReady Team",
        slug: COMPANY_SLUG,
        plan: COMPANY_PLAN,
        seats_total: plan.included_seats,
        status: "active",
        billing_cycle: "monthly",
        // Renews 30 days out so the Billing overview shows a real date.
        current_period_end: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        signed_up_source: "seed",
        // HomeReady shows the full leaderboard to agents (Phase 10).
        leaderboard_visible_to_agents: true,
        brokerage_name: "Real Brokerage",
        brokerage_license_number: null,
        brokerage_state: "CA",
      },
      { onConflict: "slug" },
    )
    .select()
    .single();
  die("upsert company", companyErr);
  const companyId = company!.id;
  console.log(`• Company: ${company!.name} (${companyId})`);

  // 3-6) company users
  const teamLeadId = await ensureAuthUser(
    "phil@homereadyteam.com",
    "Phil",
    "team_lead",
  );
  const agentId = await ensureAuthUser(
    "philip.kang@homereadyteam.com",
    "Agent Phil",
    "agent",
  );
  const adminTcId = await ensureAuthUser(
    "rochie@homereadyteam.com",
    "Rochie Ramiro",
    "admin_tc",
  );
  const marketingId = await ensureAuthUser(
    "krisha@homereadyteam.com",
    "Krisha Ortega",
    "marketing",
  );

  const now = new Date().toISOString();
  await upsertProfile({
    id: teamLeadId,
    company_id: companyId,
    email: "phil@homereadyteam.com",
    full_name: "Phil",
    role: "team_lead",
    status: "active",
    last_active_at: now,
  });
  await upsertProfile({
    id: agentId,
    company_id: companyId,
    email: "philip.kang@homereadyteam.com",
    full_name: "Agent Phil",
    role: "agent",
    license_number: "DRE #01999888",
    status: "active",
    last_active_at: now,
  });
  await upsertProfile({
    id: adminTcId,
    company_id: companyId,
    email: "rochie@homereadyteam.com",
    full_name: "Rochie Ramiro",
    role: "admin_tc",
    status: "active",
    last_active_at: now,
  });
  await upsertProfile({
    id: marketingId,
    company_id: companyId,
    email: "krisha@homereadyteam.com",
    full_name: "Krisha Ortega",
    role: "marketing",
    status: "active",
    last_active_at: now,
  });

  // Extra agents who went quiet weeks ago. They push the "agent" role over the
  // >=3 stalled threshold in two sections so the dashboard alert banner (PA-2)
  // is demonstrable. Their stalled progress rows are seeded below.
  const stalledAgentIds: string[] = [];
  for (const n of [1, 2, 3]) {
    const email = `stalled-agent-${n}@homereadyteam.com`;
    const id = await ensureAuthUser(email, `Stalled Agent ${n}`, "agent");
    await upsertProfile({
      id,
      company_id: companyId,
      email,
      full_name: `Stalled Agent ${n}`,
      role: "agent",
      status: "active",
      last_active_at: now,
    });
    stalledAgentIds.push(id);
  }
  console.log("• Users: 1 super_admin + 7 company members");

  // ── clear this company's sample data for a clean re-seed ────────────────────
  await admin.from("message_threads").delete().eq("company_id", companyId);
  await admin.from("training_sections").delete().eq("company_id", companyId);
  await admin.from("deals").delete().eq("company_id", companyId);
  await admin.from("requests").delete().eq("company_id", companyId);
  await admin.from("deal_types").delete().eq("company_id", companyId);
  await admin.from("request_types").delete().eq("company_id", companyId);
  await admin.from("activity_logs").delete().eq("company_id", companyId);
  await admin.from("goals").delete().eq("company_id", companyId);
  await admin
    .from("coaching_log_entries")
    .delete()
    .in("agent_user_id", [agentId]);
  await admin.from("cancellations").delete().eq("company_id", companyId);

  // Sample cancellation reasons for super-admin reporting visualization.
  await admin.from("cancellations").insert([
    {
      company_id: companyId,
      user_id: teamLeadId,
      reason_category: "price",
      optional_feedback:
        "Loved the product but the budget got cut this quarter.",
      scheduled_for: daysAgoDate(40),
      completed_at: new Date(
        Date.now() - 38 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    },
    {
      company_id: companyId,
      user_id: teamLeadId,
      reason_category: "switching",
      reason_text: "Evaluated a competitor",
      scheduled_for: daysAgoDate(12),
    },
  ]);

  // 7) training: 3 sections (varying visibility) x 3 modules
  const sectionSpecs: Array<{
    title: string;
    visible: UserRole[];
    position: number;
  }> = [
    { title: "Company Onboarding", visible: [], position: 0 }, // all roles
    { title: "Agent Sales Mastery", visible: ["agent"], position: 1 },
    {
      title: "Ops & Marketing Playbook",
      visible: ["admin_tc", "marketing"],
      position: 2,
    },
  ];

  // Captured per section so we can seed realistic per-user progress below.
  const moduleIdsByTitle = new Map<string, string[]>();
  for (const spec of sectionSpecs) {
    const { data: section, error: secErr } = await admin
      .from("training_sections")
      .insert({
        company_id: companyId,
        title: spec.title,
        description: `${spec.title} — seeded section.`,
        visible_to_roles: spec.visible,
        position: spec.position,
        status: "published",
        created_by: teamLeadId,
      })
      .select()
      .single();
    die(`insert section ${spec.title}`, secErr);

    const modules: Tables["training_modules"]["Insert"][] = [0, 1, 2].map(
      (i) => ({
        section_id: section!.id,
        title: `${spec.title} — Lesson ${i + 1}`,
        description: `Lesson ${i + 1} of ${spec.title}.`,
        content: moduleContent(`${spec.title} — Lesson ${i + 1}`),
        position: i,
        estimated_minutes: 15 + i * 10,
        recommended_timeline_days: (i + 1) * 7,
        status: "published",
        visible_to_roles: [],
      }),
    );
    const { data: insertedModules, error: modErr } = await admin
      .from("training_modules")
      .insert(modules)
      .select("id, position");
    die(`insert modules for ${spec.title}`, modErr);
    moduleIdsByTitle.set(
      spec.title,
      (insertedModules ?? [])
        .sort((a, b) => a.position - b.position)
        .map((m) => m.id),
    );
  }
  console.log("• Training: 3 sections × 3 modules");

  // ── sample per-user progress so the learner view + progress dashboard have
  // meaningful data (completed / in-progress / stalled). Timestamps in the past
  // exercise the 14-day "stalled" threshold (PA-2).
  const tsAgo = (days: number): string =>
    new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const onboarding = moduleIdsByTitle.get("Company Onboarding") ?? [];
  const sales = moduleIdsByTitle.get("Agent Sales Mastery") ?? [];
  const ops = moduleIdsByTitle.get("Ops & Marketing Playbook") ?? [];

  type ProgressSeed = Tables["training_progress"]["Insert"];
  const progressRows: ProgressSeed[] = [];
  const completed = (uid: string, mid: string, days: number): ProgressSeed => ({
    user_id: uid,
    module_id: mid,
    status: "completed",
    started_at: tsAgo(days + 2),
    completed_at: tsAgo(days),
    last_viewed_at: tsAgo(days),
  });
  const inProgress = (
    uid: string,
    mid: string,
    days: number,
  ): ProgressSeed => ({
    user_id: uid,
    module_id: mid,
    status: "in_progress",
    started_at: tsAgo(days + 1),
    last_viewed_at: tsAgo(days),
  });

  // Agent Phil: finished onboarding, mid-way (recently) through sales.
  if (onboarding[0]) progressRows.push(completed(agentId, onboarding[0], 10));
  if (onboarding[1]) progressRows.push(completed(agentId, onboarding[1], 8));
  if (sales[0]) progressRows.push(inProgress(agentId, sales[0], 2));
  // Admin/TC: started onboarding but went quiet 20 days ago (stalled).
  if (onboarding[0])
    progressRows.push(inProgress(adminTcId, onboarding[0], 20));
  // Three extra agents stalled in two sections → trips the >=3 alert banner for
  // both agent·Company Onboarding and agent·Agent Sales Mastery.
  for (const uid of stalledAgentIds) {
    if (onboarding[0]) progressRows.push(inProgress(uid, onboarding[0], 20));
    if (sales[0]) progressRows.push(inProgress(uid, sales[0], 18));
  }
  // Marketing: knocked out the whole onboarding section.
  for (const mid of onboarding)
    progressRows.push(completed(marketingId, mid, 5));
  // Marketing started the ops playbook recently.
  if (ops[0]) progressRows.push(inProgress(marketingId, ops[0], 1));

  if (progressRows.length) {
    const { error: progErr } = await admin
      .from("training_progress")
      .insert(progressRows);
    die("insert training_progress", progErr);
  }
  console.log(`• Training progress: ${progressRows.length} rows`);

  // deal types
  const { data: dealTypes, error: dtErr } = await admin
    .from("deal_types")
    .insert([
      { company_id: companyId, name: "Buyer-Side", position: 0 },
      { company_id: companyId, name: "Seller-Side Listing", position: 1 },
    ])
    .select();
  die("insert deal_types", dtErr);

  // global stages (seeded by migration 0005)
  const { data: stages, error: stErr } = await admin
    .from("deal_stages")
    .select("id,name")
    .is("company_id", null);
  die("select deal_stages", stErr);
  const stageId = (name: string) =>
    stages!.find((s) => s.name === name)?.id ?? null;

  // 8) five deals across stages
  const dealRows: Tables["deals"]["Insert"][] = [
    {
      company_id: companyId,
      deal_type_id: dealTypes![1].id,
      stage_id: stageId("Active"),
      representing: "seller",
      property_address: "123 Maple St",
      property_city: "Pasadena",
      property_state: "CA",
      property_zip: "91101",
      client_first_name: "Dana",
      client_last_name: "Reed",
      sales_price_cents: 89900000,
      gci_cents: 2697000,
      commission_pct: 3.0,
      listing_agent_id: agentId,
      created_by: agentId,
    },
    {
      company_id: companyId,
      // Cancelled = a signed buyer agreement that fell through (financing).
      // Demonstrates the new terminal-lost stage in the coaching pipeline summary.
      deal_type_id: dealTypes![0].id,
      stage_id: stageId("Cancelled"),
      representing: "buyer",
      property_address: "55 Oak Ave",
      property_city: "Glendale",
      property_state: "CA",
      property_zip: "91205",
      client_first_name: "Marcus",
      client_last_name: "Lee",
      sales_price_cents: 102500000,
      gci_cents: 3075000,
      commission_pct: 3.0,
      buyer_agent_id: agentId,
      rpa_signed_date: daysAgoDate(10),
      inspection_contingency_days: 17,
      appraisal_contingency_days: 21,
      loan_contingency_days: 21,
      created_by: agentId,
    },
    {
      company_id: companyId,
      deal_type_id: dealTypes![0].id,
      stage_id: stageId("Under Contract"),
      representing: "buyer",
      property_address: "78 Pine Ct",
      property_city: "Burbank",
      property_state: "CA",
      property_zip: "91502",
      client_first_name: "Sofia",
      client_last_name: "Marquez",
      sales_price_cents: 76000000,
      gci_cents: 2280000,
      commission_pct: 3.0,
      buyer_agent_id: agentId,
      close_date: daysAgoDate(-14),
      created_by: agentId,
    },
    {
      company_id: companyId,
      deal_type_id: dealTypes![1].id,
      stage_id: stageId("Closed"),
      representing: "seller",
      property_address: "9 Birch Blvd",
      property_city: "Altadena",
      property_state: "CA",
      property_zip: "91001",
      client_first_name: "Henry",
      client_last_name: "Okafor",
      sales_price_cents: 134000000,
      gci_cents: 4020000,
      commission_pct: 3.0,
      listing_agent_id: agentId,
      close_date: daysAgoDate(30),
      public_share_link_enabled: true,
      created_by: agentId,
    },
    {
      company_id: companyId,
      deal_type_id: dealTypes![0].id,
      stage_id: stageId("Submitted"),
      representing: "dual",
      property_address: "300 Cedar Way",
      property_city: "Monrovia",
      property_state: "CA",
      property_zip: "91016",
      client_first_name: "Priya",
      client_last_name: "Nair",
      sales_price_cents: 58000000,
      listing_agent_id: agentId,
      buyer_agent_id: agentId,
      created_by: agentId,
    },
    {
      company_id: companyId,
      // Expired = a listing whose agreement period lapsed without transacting.
      deal_type_id: dealTypes![1].id,
      stage_id: stageId("Expired"),
      representing: "seller",
      property_address: "412 Walnut Dr",
      property_city: "Arcadia",
      property_state: "CA",
      property_zip: "91006",
      client_first_name: "Grace",
      client_last_name: "Tan",
      sales_price_cents: 95000000,
      listing_agent_id: agentId,
      created_by: agentId,
    },
  ];
  // defaultToNull:false so rows that omit a column (e.g. public_share_link_enabled)
  // fall back to the column DEFAULT rather than NULL on this bulk insert.
  const { error: dealErr } = await admin
    .from("deals")
    .insert(dealRows, { defaultToNull: false });
  die("insert deals", dealErr);
  console.log("• Deals: 6 across stages (incl. Cancelled + Expired)");

  // request types (smart-assignment defaults + workflow category — Phase 9)
  const requestTypeSpecs: Array<{
    name: string;
    category: "agent_support" | "field_work" | "transaction_admin" | "other";
    role: UserRole | null;
  }> = [
    { name: "Flyer Design", category: "agent_support", role: "marketing" },
    { name: "Listing Brochure", category: "agent_support", role: "marketing" },
    { name: "Social Media Post", category: "agent_support", role: "marketing" },
    { name: "MLS Update", category: "transaction_admin", role: "admin_tc" },
    { name: "Showing", category: "field_work", role: "agent" },
    { name: "Open House", category: "field_work", role: "agent" },
    { name: "Lockbox Install", category: "field_work", role: "agent" },
    { name: "Meet Appraiser", category: "field_work", role: "agent" },
    {
      name: "Home Inspection Attendance",
      category: "field_work",
      role: "agent",
    },
    { name: "AVID Completion", category: "transaction_admin", role: "agent" },
    {
      name: "Paperwork Signature",
      category: "transaction_admin",
      role: "agent",
    },
    { name: "Other", category: "other", role: null },
  ];
  const { data: reqTypes, error: rtErr } = await admin
    .from("request_types")
    .insert(
      requestTypeSpecs.map((t, i) => ({
        company_id: companyId,
        name: t.name,
        category: t.category,
        default_assignee_role: t.role,
        position: i,
      })),
    )
    .select();
  die("insert request_types", rtErr);
  const typeId = (name: string) => reqTypes!.find((t) => t.name === name)!.id;

  // 9) sample requests across categories + statuses (incl. an unclaimed
  // marketing-queue item for the Claim flow, and one Ready for Review).
  const requestRows: Tables["requests"]["Insert"][] = [
    {
      company_id: companyId,
      request_type_id: typeId("Flyer Design"),
      title: "Flyer for 123 Maple St open house",
      description: "Need a just-listed flyer by end of week.",
      status: "pending",
      priority: "normal",
      created_by: agentId,
      assigned_to_role: "marketing",
      assigned_to_user_id: marketingId,
    },
    {
      company_id: companyId,
      request_type_id: typeId("Social Media Post"),
      title: "Instagram post for new Birch Blvd listing",
      description: "Carousel of the 3 best photos + price.",
      status: "pending",
      priority: "high",
      created_by: agentId,
      assigned_to_role: "marketing",
      assigned_to_user_id: null, // unclaimed marketing queue → Claim test
    },
    {
      company_id: companyId,
      request_type_id: typeId("Showing"),
      title: "Cover showing at 55 Oak Ave Saturday 2pm",
      description: "Buyer wants Saturday afternoon.",
      status: "in_progress",
      priority: "high",
      created_by: teamLeadId,
      assigned_to_role: "agent",
      assigned_to_user_id: agentId,
      due_date: daysAgoDate(-3),
    },
    {
      company_id: companyId,
      request_type_id: typeId("MLS Update"),
      title: "Update price on 9 Birch Blvd in MLS",
      description: "Price reduced $10k; please update.",
      status: "ready_for_review",
      priority: "normal",
      created_by: agentId,
      assigned_to_role: "admin_tc",
      assigned_to_user_id: adminTcId,
      due_date: daysAgoDate(-1),
    },
    {
      company_id: companyId,
      request_type_id: typeId("AVID Completion"),
      title: "Complete AVID for 742 Evergreen Terrace",
      description: "Agent visual inspection disclosure needed.",
      status: "completed",
      priority: "normal",
      created_by: adminTcId,
      assigned_to_role: "agent",
      assigned_to_user_id: agentId,
    },
  ];
  const { error: reqErr } = await admin.from("requests").insert(requestRows);
  die("insert requests", reqErr);
  console.log(
    "• Requests: 5 (pending / unclaimed / in_progress / ready_for_review / completed)",
  );

  // 10) activity logs. Agent Phil gets 14 dense days (one of them a logged
  // off-day, to exercise the gray heatmap cell + streak-preserving semantics);
  // the three quieter agents get a week of lighter activity so the leaderboard
  // and heatmap have multiple rows.
  const activityRows: Tables["activity_logs"]["Insert"][] = [];
  // Agent Phil: 14 days back from today. Day index 3 is an off-day.
  for (let i = 0; i < 14; i++) {
    const offDay = i === 3;
    activityRows.push({
      user_id: agentId,
      company_id: companyId,
      log_date: daysAgoDate(i),
      is_off_day: offDay,
      door_knocks: offDay ? 0 : 10 + (i % 5),
      open_houses: offDay ? 0 : i % 3 === 0 ? 1 : 0,
      conversations: offDay ? 0 : 6 + (i % 4),
      seller_leads_added: offDay ? 0 : i % 2,
      buyer_leads_added: offDay ? 0 : (i + 1) % 2,
      pqs: offDay ? 0 : i % 4 === 0 ? 1 : 0,
      buyer_consults: offDay ? 0 : i % 3,
      listing_appts: offDay ? 0 : i % 2,
      cma_deliveries: offDay ? 0 : i % 2,
      zillow_appts_set: offDay ? 0 : i % 3,
      zillow_appts_met: offDay ? 0 : i % 4 === 0 ? 1 : 0,
      showings: offDay ? 0 : 2 + (i % 3),
      listings_signed: offDay ? 0 : i % 7 === 0 ? 1 : 0,
      buyer_agreements_signed: offDay ? 0 : i % 5 === 0 ? 1 : 0,
      offers_submitted: offDay ? 0 : i % 2,
    });
  }
  // The three quieter agents: 7 lighter days each. Every metric column is set
  // explicitly so all rows share one shape — PostgREST unions keys across a bulk
  // insert and sends an explicit `null` for any key a row omits, and a column
  // DEFAULT does NOT apply to an explicit null (only to an omitted key). Mixing
  // a 16-field row with a 6-field row would therefore null-out the missing
  // metrics and trip the NOT NULL/CHECK constraints.
  stalledAgentIds.forEach((uid, idx) => {
    for (let i = 0; i < 7; i++) {
      activityRows.push({
        user_id: uid,
        company_id: companyId,
        log_date: daysAgoDate(i),
        is_off_day: false,
        door_knocks: 3 + ((i + idx) % 4),
        open_houses: i % 5 === 0 ? 1 : 0,
        conversations: 2 + (i % 3),
        seller_leads_added: i % 3 === 0 ? 1 : 0,
        buyer_leads_added: i % 4 === 0 ? 1 : 0,
        pqs: i % 6 === 0 ? 1 : 0,
        buyer_consults: i % 4 === 0 ? 1 : 0,
        listing_appts: i % 5 === 0 ? 1 : 0,
        cma_deliveries: i % 6 === 0 ? 1 : 0,
        zillow_appts_set: i % 4 === 0 ? 1 : 0,
        zillow_appts_met: i % 7 === 0 ? 1 : 0,
        showings: i % 2,
        listings_signed: 0,
        buyer_agreements_signed: i % 7 === 0 ? 1 : 0,
        offers_submitted: i % 3 === 0 ? 1 : 0,
      });
    }
  });
  // defaultToNull:false makes column DEFAULTs apply to any still-omitted key as
  // a second layer of safety against the heterogeneous-shape pitfall above.
  const { error: actErr } = await admin
    .from("activity_logs")
    .insert(activityRows, { defaultToNull: false });
  die("insert activity_logs", actErr);
  console.log(
    `• Activity logs: 14 days for Agent Phil (incl. 1 off-day) + 7 days × 3 quieter agents`,
  );

  // bonus: goals (PA-6, hybrid ownership). Agent-set outcome goals + a
  // team_lead-set input goal + one team-wide goal for the "Goals vs Actuals"
  // card. period_start anchors to the current month / quarter / year.
  const today = new Date();
  const yyyy = today.getUTCFullYear();
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const monthStart = `${yyyy}-${pad2(today.getUTCMonth() + 1)}-01`;
  const quarterStart = `${yyyy}-${pad2(Math.floor(today.getUTCMonth() / 3) * 3 + 1)}-01`;
  const annualStart = `${yyyy}-01-01`;
  const { error: goalErr } = await admin.from("goals").insert([
    {
      company_id: companyId,
      user_id: agentId,
      set_by_user_id: agentId, // agent-set outcome goal
      period: "quarterly",
      period_start: quarterStart,
      goal_type: "gci_cents",
      target_value: 20000000, // $200,000
    },
    {
      company_id: companyId,
      user_id: agentId,
      set_by_user_id: agentId, // agent-set outcome goal
      period: "quarterly",
      period_start: quarterStart,
      goal_type: "closed_deals_count",
      target_value: 8,
    },
    {
      company_id: companyId,
      user_id: agentId,
      set_by_user_id: teamLeadId, // team_lead-set input goal
      period: "monthly",
      period_start: monthStart,
      goal_type: "conversations_count",
      target_value: 200,
    },
    {
      company_id: companyId,
      user_id: null, // team-wide aggregate goal
      set_by_user_id: teamLeadId,
      period: "annual",
      period_start: annualStart,
      goal_type: "gci_cents",
      target_value: 50000000, // $500,000
    },
  ]);
  die("insert goals", goalErr);
  console.log("• Goals: 3 agent goals (2 outcome + 1 input) + 1 team-wide");

  // 11) coaching log entries across several days so the dashboard's day-group
  // headers ("Today" / "Yesterday" / explicit date) are demonstrable. One entry
  // is flagged is_test=true to exercise the default test-data filter (F-109/111).
  const hoursAgo = (h: number) =>
    new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
  const { error: coachErr } = await admin.from("coaching_log_entries").insert([
    {
      agent_user_id: agentId,
      coach_user_id: teamLeadId,
      body: "Great momentum on prospecting. Focus next week on converting buyer consults to signed agreements.",
      occurred_at: hoursAgo(2),
      is_test: false,
    },
    {
      agent_user_id: agentId,
      coach_user_id: teamLeadId,
      body: "Reviewed pipeline — the Oak Ave deal cancelled on financing. Let's tighten lender pre-checks before writing offers.",
      occurred_at: hoursAgo(26), // yesterday
      is_test: false,
    },
    {
      agent_user_id: agentId,
      coach_user_id: teamLeadId,
      body: "Role-played a listing presentation. Strong on pricing story; work the objection handling.",
      occurred_at: hoursAgo(24 * 5), // ~5 days ago
      is_test: false,
    },
    {
      agent_user_id: agentId,
      coach_user_id: teamLeadId,
      body: "[seeded demo] This is sample/test coaching data.",
      occurred_at: hoursAgo(3),
      is_test: true,
    },
  ]);
  die("insert coaching_log_entry", coachErr);
  console.log("• Coaching log: 4 entries (1 flagged test)");

  // 11b) Messages (Phase 11). A DM, a group, and a marketing DM — with a reply,
  // reactions, a mention, and an attachment — plus realistic last_read_at so
  // some threads show unread for both Phil (team_lead) and Agent Phil.
  const msgAgo = (minutes: number): string =>
    new Date(Date.now() - minutes * 60_000).toISOString();

  async function seedThread(spec: {
    type: "direct" | "group";
    name: string | null;
    createdBy: string;
    participants: Array<{ userId: string; lastReadAt: string | null }>;
  }): Promise<string> {
    const { data: thread, error } = await admin
      .from("message_threads")
      .insert({
        company_id: companyId,
        type: spec.type,
        name: spec.name,
        created_by: spec.createdBy,
      })
      .select("id")
      .single();
    die("insert message_thread", error);
    const { error: pErr } = await admin
      .from("message_thread_participants")
      .insert(
        spec.participants.map((p) => ({
          thread_id: thread!.id,
          user_id: p.userId,
          last_read_at: p.lastReadAt,
        })),
      );
    die("insert message_thread_participants", pErr);
    return thread!.id;
  }

  async function seedMessage(spec: {
    threadId: string;
    senderId: string;
    body: string | null;
    minutesAgo: number;
    replyTo?: string | null;
    attachments?: Array<{
      path: string;
      name: string;
      size: number | null;
      contentType: string | null;
    }>;
  }): Promise<string> {
    const { data, error } = await admin
      .from("messages")
      .insert({
        thread_id: spec.threadId,
        sender_id: spec.senderId,
        body: spec.body,
        attachments: spec.attachments ?? [],
        reply_to_message_id: spec.replyTo ?? null,
        created_at: msgAgo(spec.minutesAgo),
      })
      .select("id")
      .single();
    die("insert message", error);
    return data!.id;
  }

  async function react(messageId: string, userId: string, emoji: string) {
    const { error } = await admin
      .from("message_reactions")
      .insert({ message_id: messageId, user_id: userId, emoji });
    die("insert message_reaction", error);
  }

  // ── DM: Phil (team_lead) ↔ Agent Phil ──
  const dmId = await seedThread({
    type: "direct",
    name: null,
    createdBy: teamLeadId,
    participants: [
      { userId: teamLeadId, lastReadAt: msgAgo(25) }, // unread: m6 (20m)
      { userId: agentId, lastReadAt: msgAgo(2865) }, // unread: m5 (30m)
    ],
  });
  await seedMessage({
    threadId: dmId,
    senderId: teamLeadId,
    body: "Hey, welcome to the team! Let me know if you have any questions.",
    minutesAgo: 2880,
  });
  const dmM2 = await seedMessage({
    threadId: dmId,
    senderId: agentId,
    body: "Thanks Phil! Excited to get started. **Where** do I find the onboarding docs?",
    minutesAgo: 2875,
  });
  const dmM3 = await seedMessage({
    threadId: dmId,
    senderId: teamLeadId,
    body: "They're under Training → Company Onboarding. Quick checklist:\n\n- Profile setup\n- Read the playbook\n- First role-play",
    minutesAgo: 2870,
  });
  await seedMessage({
    threadId: dmId,
    senderId: teamLeadId,
    body: `Quick nudge <@${agentId}> — you're off to a great start. Keep the momentum 🎉`,
    minutesAgo: 30,
  });
  await seedMessage({
    threadId: dmId,
    senderId: agentId,
    body: "Got it — working through the checklist now.",
    minutesAgo: 20,
    replyTo: dmM3,
  });
  await react(dmM2, teamLeadId, "🎉");

  // ── Group: Phil + Agent Phil + Stalled Agent 1 + Rochie (admin_tc) ──
  const groupId = await seedThread({
    type: "group",
    name: "Q3 Team Strategy",
    createdBy: teamLeadId,
    participants: [
      { userId: teamLeadId, lastReadAt: msgAgo(60) }, // unread: g5 (15m)
      { userId: agentId, lastReadAt: msgAgo(1428) }, // unread: g4 (1425m)
      { userId: stalledAgentIds[0]!, lastReadAt: msgAgo(0) },
      { userId: adminTcId, lastReadAt: msgAgo(1433) }, // unread: g3,g4,g5
    ],
  });

  // Attachment: a tiny placeholder image uploaded to the private bucket so the
  // signed-URL render path is exercised end to end.
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64",
  );
  const attachPath = `${companyId}/${groupId}/${crypto.randomUUID()}-q3-strategy.png`;
  await admin.storage
    .from("message-attachments")
    .upload(attachPath, png, { contentType: "image/png", upsert: true });

  const g1 = await seedMessage({
    threadId: groupId,
    senderId: teamLeadId,
    body: "Team, let's align on Q3 priorities. I've attached the overview.",
    minutesAgo: 1440,
    attachments: [
      {
        path: attachPath,
        name: "q3-strategy.png",
        size: png.byteLength,
        contentType: "image/png",
      },
    ],
  });
  await seedMessage({
    threadId: groupId,
    senderId: adminTcId,
    body: "Looks great — I'll handle the TC workflow updates.",
    minutesAgo: 1435,
  });
  await seedMessage({
    threadId: groupId,
    senderId: agentId,
    body: "I can take the lead-gen experiments.",
    minutesAgo: 1430,
  });
  await seedMessage({
    threadId: groupId,
    senderId: stalledAgentIds[0]!,
    body: "Sounds good 👍",
    minutesAgo: 1425,
  });
  await seedMessage({
    threadId: groupId,
    senderId: agentId,
    body: "Pushing the first experiment live today 🚀",
    minutesAgo: 15,
  });
  await react(g1, adminTcId, "❤️");
  await react(g1, agentId, "❤️");

  // ── DM: Phil (team_lead) ↔ Krisha (marketing) about a flyer ──
  const flyerDmId = await seedThread({
    type: "direct",
    name: null,
    createdBy: marketingId,
    participants: [
      { userId: teamLeadId, lastReadAt: msgAgo(0) },
      { userId: marketingId, lastReadAt: msgAgo(0) },
    ],
  });
  const f1 = await seedMessage({
    threadId: flyerDmId,
    senderId: marketingId,
    body: "Hi Phil! The open-house flyer for 123 Main St is ready. Want me to post it?",
    minutesAgo: 45,
  });
  await seedMessage({
    threadId: flyerDmId,
    senderId: teamLeadId,
    body: "Yes please — looks awesome. ✅",
    minutesAgo: 40,
  });
  await react(f1, teamLeadId, "✅");

  console.log("• Messages: 3 threads (DM, group, marketing DM) w/ reactions");

  // 11c) Channels (Phase 11.5). #general (replaces the migration backfill, which
  // is wiped by the message_threads clear above), three more public channels, and
  // one private #leadership. Membership follows the spec's role rules.
  async function seedChannel(spec: {
    name: string;
    description: string;
    visibility: "public" | "private";
    createdBy: string;
    memberIds: string[];
  }): Promise<string> {
    const { data: thread, error } = await admin
      .from("message_threads")
      .insert({
        company_id: companyId,
        type: "channel",
        name: spec.name,
        visibility: spec.visibility,
        description: spec.description,
        created_by: spec.createdBy,
      })
      .select("id")
      .single();
    die(`insert channel ${spec.name}`, error);
    const { error: pErr } = await admin
      .from("message_thread_participants")
      .insert(
        spec.memberIds.map((user_id) => ({
          thread_id: thread!.id,
          user_id,
          last_read_at: now,
        })),
      );
    die(`insert channel participants ${spec.name}`, pErr);
    return thread!.id;
  }

  async function seedSystemMessage(
    threadId: string,
    body: string,
    minutesAgo: number,
  ): Promise<void> {
    const { error } = await admin.from("messages").insert({
      thread_id: threadId,
      sender_id: null,
      is_system: true,
      body,
      created_at: msgAgo(minutesAgo),
    });
    die("insert system message", error);
  }

  const allUserIds = [
    teamLeadId,
    agentId,
    adminTcId,
    marketingId,
    ...stalledAgentIds,
  ];
  const agentRoleIds = [agentId, ...stalledAgentIds];

  const generalId = await seedChannel({
    name: "general",
    description: "Company-wide channel for everyone",
    visibility: "public",
    createdBy: teamLeadId,
    memberIds: allUserIds,
  });
  await seedMessage({
    threadId: generalId,
    senderId: teamLeadId,
    body: "Welcome to #general 👋 — company-wide announcements land here.",
    minutesAgo: 600,
  });
  await seedMessage({
    threadId: generalId,
    senderId: adminTcId,
    body: "Reminder: submit your timesheets by Friday EOD.",
    minutesAgo: 300,
  });

  const winsId = await seedChannel({
    name: "wins",
    description: "Celebrate closings and good news",
    visibility: "public",
    createdBy: teamLeadId,
    memberIds: allUserIds,
  });
  const winsM1 = await seedMessage({
    threadId: winsId,
    senderId: agentId,
    body: "Just closed 123 Main St 🎉 buyers are thrilled!",
    minutesAgo: 240,
  });
  await seedMessage({
    threadId: winsId,
    senderId: teamLeadId,
    body: "Huge week, team — <@channel> let's keep this momentum going! 🔥",
    minutesAgo: 180,
  });
  await react(winsM1, teamLeadId, "🎉");
  await react(winsM1, adminTcId, "🏆");

  const dealsId = await seedChannel({
    name: "deals",
    description: "Active deal discussion",
    visibility: "public",
    createdBy: teamLeadId,
    memberIds: [teamLeadId, adminTcId, ...agentRoleIds],
  });
  await seedMessage({
    threadId: dealsId,
    senderId: agentId,
    body: "Anyone have a preferred lender for a first-time VA buyer?",
    minutesAgo: 120,
  });
  await seedMessage({
    threadId: dealsId,
    senderId: adminTcId,
    body: "I'll DM you a couple we've had smooth closings with.",
    minutesAgo: 110,
  });

  const mktgReqId = await seedChannel({
    name: "marketing-requests",
    description: "Coordinate with marketing team",
    visibility: "public",
    createdBy: teamLeadId,
    memberIds: [teamLeadId, adminTcId, marketingId],
  });
  await seedSystemMessage(mktgReqId, "Krisha joined the channel", 200);
  await seedMessage({
    threadId: mktgReqId,
    senderId: teamLeadId,
    body: `Can we get an open-house flyer for 456 Oak Ave? <@${marketingId}>`,
    minutesAgo: 90,
  });
  await seedMessage({
    threadId: mktgReqId,
    senderId: marketingId,
    body: "On it — draft by tomorrow morning ✅",
    minutesAgo: 80,
  });

  const leadershipId = await seedChannel({
    name: "leadership",
    description: "Leadership-only discussion",
    visibility: "private",
    createdBy: teamLeadId,
    memberIds: [teamLeadId, adminTcId],
  });
  await seedMessage({
    threadId: leadershipId,
    senderId: teamLeadId,
    body: "Q3 planning sync Thursday — agenda to follow.",
    minutesAgo: 150,
  });
  await seedMessage({
    threadId: leadershipId,
    senderId: adminTcId,
    body: "Sounds good, I'll prep the pipeline numbers.",
    minutesAgo: 140,
  });

  console.log(
    "• Channels: #general, #wins, #deals, #marketing-requests, #leadership (private)",
  );

  // 12) platform feature flags (Phase 5 editor). Seeded disabled; consuming code
  // lands in later phases. Upsert by key so re-seeding is idempotent and never
  // clobbers an operator's toggles beyond re-asserting the canonical description.
  const featureFlags: Array<{ key: string; description: string }> = [
    {
      key: "flag_role_based_sections",
      description: "Role-scoped training section visibility.",
    },
    {
      key: "flag_training_dashboard",
      description: "New training progress dashboard.",
    },
    {
      key: "flag_drag_drop_reorder",
      description: "Drag-and-drop reordering of sections/modules.",
    },
    {
      key: "flag_redesigned_requests",
      description: "Redesigned requests queue UX.",
    },
    {
      key: "flag_lightweight_coaching",
      description: "Lightweight coaching log experience.",
    },
    {
      key: "flag_team_lead_dashboard_v2",
      description: "Rebuilt team-lead dashboard (Phase 13).",
    },
    { key: "flag_new_billing_ux", description: "New billing UX (Phase 12)." },
  ];
  for (const f of featureFlags) {
    const { error } = await admin
      .from("feature_flags")
      .upsert(
        { key: f.key, description: f.description },
        { onConflict: "key", ignoreDuplicates: true },
      );
    die(`upsert feature_flag ${f.key}`, error);
  }
  console.log(`• Feature flags: ${featureFlags.length} seeded`);

  // ── credentials report ──────────────────────────────────────────────────────
  console.log("\n────────────────────────────────────────────────────────");
  console.log("Seed complete. Login credentials (password for all):");
  console.log(`  password: ${PASSWORD}\n`);
  console.log("  super_admin   phil@teamapp.ai");
  console.log("  team_lead     phil@homereadyteam.com");
  console.log("  agent         philip.kang@homereadyteam.com");
  console.log("  admin_tc      rochie@homereadyteam.com");
  console.log("  marketing     krisha@homereadyteam.com");
  console.log("────────────────────────────────────────────────────────");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
