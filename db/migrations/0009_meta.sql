-- 0009_meta.sql
-- Platform/meta tables: audit log (audit CR-4), server-side feature flags,
-- Stripe webhook idempotency log (used in Phase 12).

-- ── audit_log (append-only) ───────────────────────────────────────────────────
create table if not exists public.audit_log (
  id            uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.users (id) on delete set null,
  action        text not null,
  resource_type text,
  resource_id   uuid,
  payload       jsonb not null default '{}'::jsonb,
  ip_address    inet,
  user_agent    text,
  created_at    timestamptz not null default now()
);

comment on table public.audit_log is
  'Append-only record of sensitive/super-admin actions and important state changes (audit CR-4).';

-- ── feature_flags (server-side; complements PostHog) ──────────────────────────
create table if not exists public.feature_flags (
  id                  uuid primary key default gen_random_uuid(),
  key                 text not null unique,
  enabled_globally    boolean not null default false,
  enabled_company_ids uuid[] not null default '{}',
  description         text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

drop trigger if exists set_feature_flags_updated_at on public.feature_flags;
create trigger set_feature_flags_updated_at
  before update on public.feature_flags
  for each row execute function public.set_updated_at();

-- ── subscription_events (Stripe webhook idempotency) ──────────────────────────
create table if not exists public.subscription_events (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid references public.companies (id) on delete cascade,  -- nullable: may arrive unmatched
  stripe_event_id text not null unique,                                     -- idempotency key
  event_type      text,
  payload         jsonb,
  processed_at    timestamptz,
  created_at      timestamptz not null default now()
);

comment on column public.subscription_events.stripe_event_id is
  'Stripe event id; UNIQUE so webhook deliveries are processed at-most-once (Phase 12).';
