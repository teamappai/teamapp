-- 0023_coaching_phase10.sql
-- Phase 10 (Coaching + Activity Log). Three concerns:
--   1. Deal-stage domain correction — "Pending" and "Under Contract" are the
--      same operational state in residential RE, so they merge into one
--      "Under Contract" stage. "Lost/Trash" becomes "Trash" (early catch-all
--      loss) and two new terminal-lost stages appear: "Cancelled" (signed
--      agreement terminated) and "Expired" (agreement period lapsed).
--   2. activity_logs gains the HomeReady-validated metric set (PQs, signed
--      agreements) plus an explicit off-day flag, and the DB-leads columns are
--      renamed to the clearer seller/buyer_leads_added.
--   3. Coaching needs hybrid goal ownership (goals.set_by_user_id), a per-company
--      leaderboard visibility flag, more goal_type values, and a funnel view.

-- ════════════════════════════════════════════════════════════════════════════
-- 1. Deal-stage domain correction (global stages only; company_id IS NULL)
-- ════════════════════════════════════════════════════════════════════════════

-- 1a. Move any deals sitting in "Pending" to "Under Contract" before removing it.
update public.deals
set stage_id = (
  select id from public.deal_stages
  where name = 'Under Contract' and company_id is null
)
where stage_id in (
  select id from public.deal_stages where name = 'Pending' and company_id is null
);

-- 1b. Drop the redundant Pending stage.
delete from public.deal_stages
where name = 'Pending' and company_id is null;

-- 1c. Rename Lost/Trash -> Trash (early-stage catch-all loss).
update public.deal_stages
set name = 'Trash'
where name = 'Lost/Trash' and company_id is null;

-- 1d. Under Contract carries a 75% pipeline probability (post-merge canonical).
update public.deal_stages
set probability_pct = 75
where name = 'Under Contract' and company_id is null;

-- 1e. Cancelled (terminal_lost): signed agreement terminated before completion.
insert into public.deal_stages
  (company_id, name, position, color, probability_pct, is_terminal_won, is_terminal_lost)
select null, 'Cancelled', 90, '#9ca3af', 0, false, true
where not exists (
  select 1 from public.deal_stages where name = 'Cancelled' and company_id is null
);

-- 1f. Expired (terminal_lost): listing/buyer-rep agreement lapsed without a deal.
insert into public.deal_stages
  (company_id, name, position, color, probability_pct, is_terminal_won, is_terminal_lost)
select null, 'Expired', 91, '#9ca3af', 0, false, true
where not exists (
  select 1 from public.deal_stages where name = 'Expired' and company_id is null
);

-- 1g. Normalize the canonical global ordering so selectors read in a sane order:
--     Submitted, Under Review, Active, Under Contract, Closed, Cancelled,
--     Expired, Trash.
update public.deal_stages as s set position = v.position
from (values
  ('Submitted',      0),
  ('Under Review',   1),
  ('Active',         2),
  ('Under Contract', 3),
  ('Closed',         4),
  ('Cancelled',      5),
  ('Expired',        6),
  ('Trash',          7)
) as v(name, position)
where s.company_id is null and s.name = v.name;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. activity_logs metric set (HomeReady-validated)
-- ════════════════════════════════════════════════════════════════════════════

alter table public.activity_logs
  rename column db_seller_leads to seller_leads_added;
alter table public.activity_logs
  rename column db_buyer_leads to buyer_leads_added;

alter table public.activity_logs
  add column if not exists pqs integer not null default 0 check (pqs >= 0);
alter table public.activity_logs
  add column if not exists listings_signed integer not null default 0
    check (listings_signed >= 0);
alter table public.activity_logs
  add column if not exists buyer_agreements_signed integer not null default 0
    check (buyer_agreements_signed >= 0);

-- Off-day: the agent legitimately did not work this day. Distinct from a worked
-- day where every metric happened to be 0. Both extend the streak; off-days are
-- excluded from per-day averages but still count as factual zeros in totals.
alter table public.activity_logs
  add column if not exists is_off_day boolean not null default false;

comment on column public.activity_logs.is_off_day is
  'Legitimate day off (vacation/rest). All metrics are 0, the day still extends the streak, and it is excluded from average denominators (Phase 10).';
comment on column public.activity_logs.pqs is
  'Pre-qualification letters obtained for buyer clients (Phase 10).';
comment on column public.activity_logs.listings_signed is
  'Listing agreements signed by sellers (highest-leverage conversion event, Phase 10).';
comment on column public.activity_logs.buyer_agreements_signed is
  'Formal buyer representation agreements signed (Phase 10).';

-- ════════════════════════════════════════════════════════════════════════════
-- 3a. Per-company leaderboard visibility
-- ════════════════════════════════════════════════════════════════════════════

alter table public.companies
  add column if not exists leaderboard_visible_to_agents boolean not null default false;

comment on column public.companies.leaderboard_visible_to_agents is
  'When true, agents see the full team leaderboard on /app/coaching; when false they see only their own numbers and goals (Phase 10).';

-- ════════════════════════════════════════════════════════════════════════════
-- 3b. Hybrid goal ownership (PA-6 refined): who set the goal
-- ════════════════════════════════════════════════════════════════════════════

alter table public.goals
  add column if not exists set_by_user_id uuid references public.users (id) on delete set null;

comment on column public.goals.set_by_user_id is
  'Who created/last set this goal. Agents commonly set outcome goals; team_leads commonly set input goals. Either may edit any goal in scope (Phase 10).';

-- ════════════════════════════════════════════════════════════════════════════
-- 3c. goal_type enum — input/standard goal types alongside the outcome ones.
--     (ALTER TYPE ADD VALUE is not used elsewhere in this migration, so adding
--     the labels here is transaction-safe.)
-- ════════════════════════════════════════════════════════════════════════════

alter type public.goal_type add value if not exists 'listings_signed_count';
alter type public.goal_type add value if not exists 'buyer_agreements_signed_count';
alter type public.goal_type add value if not exists 'pqs_count';
alter type public.goal_type add value if not exists 'showings_count';
alter type public.goal_type add value if not exists 'offers_submitted_count';
alter type public.goal_type add value if not exists 'top_of_funnel_count';

-- ════════════════════════════════════════════════════════════════════════════
-- 3d. v_company_funnel — per-day funnel-group sums with the agent's role, so the
--     coaching dashboard can aggregate by company + date range + role (F-114).
--     security_invoker so the caller's RLS on activity_logs/users still applies.
-- ════════════════════════════════════════════════════════════════════════════

create or replace view public.v_company_funnel
with (security_invoker = true) as
select
  al.company_id,
  al.user_id,
  u.role,
  al.log_date,
  al.is_off_day,
  (al.door_knocks + al.open_houses + al.conversations
     + al.seller_leads_added + al.buyer_leads_added + al.pqs)        as top_of_funnel,
  (al.buyer_consults + al.listing_appts + al.cma_deliveries
     + al.zillow_appts_set + al.zillow_appts_met)                    as appointments,
  (al.showings + al.listings_signed + al.buyer_agreements_signed
     + al.offers_submitted)                                          as pipeline,
  al.showings,
  al.offers_submitted
from public.activity_logs al
join public.users u on u.id = al.user_id;

comment on view public.v_company_funnel is
  'Per-agent-per-day funnel-group sums + role for coaching aggregation (audit F-114). Filter by company_id, role, and a log_date range, then SUM.';
