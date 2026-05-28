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
        signed_up_source: "seed",
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
  console.log("• Users: 1 super_admin + 4 company members");

  // ── clear this company's sample data for a clean re-seed ────────────────────
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
    const { error: modErr } = await admin
      .from("training_modules")
      .insert(modules);
    die(`insert modules for ${spec.title}`, modErr);
  }
  console.log("• Training: 3 sections × 3 modules");

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
      deal_type_id: dealTypes![0].id,
      stage_id: stageId("Pending"),
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
  ];
  const { error: dealErr } = await admin.from("deals").insert(dealRows);
  die("insert deals", dealErr);
  console.log("• Deals: 5 across stages");

  // request types (smart-assignment defaults)
  const { data: reqTypes, error: rtErr } = await admin
    .from("request_types")
    .insert([
      {
        company_id: companyId,
        name: "Flyer Design",
        default_assignee_role: "marketing",
        position: 0,
      },
      {
        company_id: companyId,
        name: "Showing",
        default_assignee_role: "admin_tc",
        position: 1,
      },
      {
        company_id: companyId,
        name: "MLS Listing Entry",
        default_assignee_role: "admin_tc",
        position: 2,
      },
    ])
    .select();
  die("insert request_types", rtErr);

  // 9) three requests in different states
  const requestRows: Tables["requests"]["Insert"][] = [
    {
      company_id: companyId,
      request_type_id: reqTypes![0].id,
      title: "Just-listed flyer for 123 Maple St",
      description: "Need a flyer by end of week.",
      status: "pending",
      priority: "normal",
      created_by: agentId,
      assigned_to_role: "marketing",
      assigned_to_user_id: marketingId,
    },
    {
      company_id: companyId,
      request_type_id: reqTypes![1].id,
      title: "Schedule showing for 55 Oak Ave",
      description: "Buyer wants Saturday afternoon.",
      status: "in_progress",
      priority: "high",
      created_by: agentId,
      assigned_to_role: "admin_tc",
      assigned_to_user_id: adminTcId,
      due_date: daysAgoDate(-3),
    },
    {
      company_id: companyId,
      request_type_id: reqTypes![2].id,
      title: "Enter 9 Birch Blvd into MLS",
      description: "Listing went live; record it.",
      status: "completed",
      priority: "normal",
      created_by: agentId,
      assigned_to_role: "admin_tc",
      assigned_to_user_id: adminTcId,
    },
  ];
  const { error: reqErr } = await admin.from("requests").insert(requestRows);
  die("insert requests", reqErr);
  console.log("• Requests: 3 (pending / in_progress / completed)");

  // 10) seven days of activity logs for the agent
  const activityRows: Tables["activity_logs"]["Insert"][] = [];
  for (let i = 0; i < 7; i++) {
    activityRows.push({
      user_id: agentId,
      company_id: companyId,
      log_date: daysAgoDate(i),
      door_knocks: 10 + i,
      open_houses: i % 3 === 0 ? 1 : 0,
      conversations: 5 + (i % 4),
      db_seller_leads: i % 2,
      db_buyer_leads: (i + 1) % 2,
      buyer_consults: i % 3,
      listing_appts: i % 2,
      cma_deliveries: i % 2,
      zillow_appts_set: i % 3,
      zillow_appts_met: i % 4 === 0 ? 1 : 0,
      showings: 2 + (i % 3),
      offers_submitted: i % 2,
    });
  }
  const { error: actErr } = await admin
    .from("activity_logs")
    .insert(activityRows);
  die("insert activity_logs", actErr);
  console.log("• Activity logs: 7 days for Agent Phil");

  // bonus: goals (PA-6) — one individual + one team-wide
  const periodStart = `${new Date().getUTCFullYear()}-01-01`;
  const { error: goalErr } = await admin.from("goals").insert([
    {
      company_id: companyId,
      user_id: agentId,
      period: "annual",
      period_start: periodStart,
      goal_type: "closed_deals_count",
      target_value: 24,
    },
    {
      company_id: companyId,
      user_id: null,
      period: "annual",
      period_start: periodStart,
      goal_type: "gci_cents",
      target_value: 50000000,
    },
  ]);
  die("insert goals", goalErr);
  console.log("• Goals: 1 individual + 1 team-wide");

  // 11) one coaching log entry tied to the agent
  const { error: coachErr } = await admin.from("coaching_log_entries").insert({
    agent_user_id: agentId,
    coach_user_id: teamLeadId,
    body: "Great momentum on prospecting. Focus next week on converting buyer consults to signed agreements.",
    occurred_at: new Date().toISOString(),
    is_test: false,
  });
  die("insert coaching_log_entry", coachErr);
  console.log("• Coaching log: 1 entry");

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
