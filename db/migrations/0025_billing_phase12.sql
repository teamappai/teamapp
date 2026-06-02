-- 0025_billing_phase12.sql
-- Phase 12 — Stripe billing.
--
-- Reconciles the spec's billing schema with the existing enum-based companies
-- table (migrations 0002/0003). Rather than the spec's literal TEXT columns
-- (plan/status/seats_total/stripe_* already exist as enum/typed columns), this:
--   • renames the `brokerage` plan to `enterprise` (canonical Phase 12 naming)
--   • extends company_status with `cancellation_scheduled` + `suspended`
--     (the spec's `trial`/`cancelled` map to the existing `trialing`/`canceled`)
--   • adds billing_cycle / current_period_end / cancellation_scheduled_for
--   • extends subscription_events with notification_sent (threshold tracking)
--   • creates the cancellations table (Decision 7 reason capture)

-- ── plan enum: brokerage → enterprise ─────────────────────────────────────────
-- RENAME VALUE rewrites every existing companies.plan row automatically.
do $$
begin
  if exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'company_plan' and e.enumlabel = 'brokerage'
  ) and not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'company_plan' and e.enumlabel = 'enterprise'
  ) then
    alter type public.company_plan rename value 'brokerage' to 'enterprise';
  end if;
end $$;

-- ── status enum: add the two genuinely-new states ─────────────────────────────
-- ADD VALUE is idempotent via IF NOT EXISTS. Existing 'trialing' serves the
-- spec's "trial"; existing 'canceled' serves "cancelled".
alter type public.company_status add value if not exists 'cancellation_scheduled';
alter type public.company_status add value if not exists 'suspended';

-- ── companies: new billing columns ────────────────────────────────────────────
alter table public.companies
  add column if not exists billing_cycle text
    check (billing_cycle in ('monthly', 'annual'));
alter table public.companies
  add column if not exists current_period_end timestamptz;
alter table public.companies
  add column if not exists cancellation_scheduled_for timestamptz;

comment on column public.companies.billing_cycle is
  'monthly | annual. Null until a paid subscription exists (Phase 12).';
comment on column public.companies.current_period_end is
  'Renewal/billed-through date, mirrored from the Stripe subscription.';
comment on column public.companies.cancellation_scheduled_for is
  'Set when status = cancellation_scheduled; access continues until this date.';

-- New self-serve signups default to a Launch-sized seat allotment.
alter table public.companies alter column seats_total set default 5;

-- ── subscription_events: threshold/notification tracking ──────────────────────
alter table public.subscription_events
  add column if not exists notification_sent boolean not null default false;

create index if not exists idx_subscription_events_company
  on public.subscription_events (company_id, processed_at desc);

-- ── cancellations (Decision 7 reason capture) ─────────────────────────────────
create table if not exists public.cancellations (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies (id) on delete cascade,
  user_id           uuid references public.users (id) on delete set null,
  reason_category   text not null,
  reason_text       text,
  optional_feedback text,
  scheduled_for     date not null,
  completed_at      timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists idx_cancellations_company
  on public.cancellations (company_id, created_at desc);

comment on table public.cancellations is
  'Cancellation reason capture (Phase 12, Decision 7). One row per scheduled cancel.';

-- RLS: mirror subscription_events — super_admin or the company''s team_lead may
-- read; all writes go through the service-role client in server actions.
alter table public.cancellations enable row level security;

drop policy if exists cancellations_select on public.cancellations;
create policy cancellations_select on public.cancellations for select to authenticated
  using (public.is_super_admin() or public.can_manage_company(company_id));

drop policy if exists cancellations_write on public.cancellations;
create policy cancellations_write on public.cancellations for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());
