-- 0003_companies_users.sql
-- Tenancy root (companies) + identity (users, mirrored from auth.users) +
-- invitations.

-- ── companies ────────────────────────────────────────────────────────────────
create table if not exists public.companies (
  id                     uuid primary key default gen_random_uuid(),
  name                   text not null,
  slug                   text not null unique,
  logo_url               text,
  plan                   public.company_plan   not null default 'launch',
  seats_total            integer               not null default 1 check (seats_total >= 0),
  stripe_customer_id     text,
  stripe_subscription_id text,
  status                 public.company_status not null default 'trialing',
  trial_ends_at          timestamptz,
  signed_up_source       text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  deleted_at             timestamptz
);

comment on table public.companies is
  'Tenant root. Every customer-scoped row carries company_id -> companies.id.';

drop trigger if exists set_companies_updated_at on public.companies;
create trigger set_companies_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

-- ── users (mirror of auth.users with app profile + tenancy) ───────────────────
create table if not exists public.users (
  id             uuid primary key references auth.users (id) on delete cascade,
  company_id     uuid references public.companies (id) on delete cascade,
  email          text not null unique,
  full_name      text,
  avatar_url     text,
  role           public.user_role   not null,
  license_number text,                       -- agents only (audit F-009)
  phone          text,
  status         public.user_status not null default 'invited',
  invited_at     timestamptz,
  last_active_at timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  -- super_admin is platform staff (no company); everyone else is company-bound.
  constraint users_company_scope_ck check (
    (role = 'super_admin' and company_id is null)
    or (role <> 'super_admin' and company_id is not null)
  )
);

comment on column public.users.id is
  'Matches auth.users.id 1:1. Row is created alongside the auth user.';
comment on column public.users.license_number is
  'Real-estate license number; only meaningful for agents (audit F-009).';

drop trigger if exists set_users_updated_at on public.users;
create trigger set_users_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

-- ── user_invitations ──────────────────────────────────────────────────────────
create table if not exists public.user_invitations (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references public.companies (id) on delete cascade,
  email              text not null,
  role               public.user_role not null,
  invited_by         uuid references public.users (id) on delete set null,
  token              text not null unique,
  accepted_at        timestamptz,
  expires_at         timestamptz not null default (now() + interval '7 days'),
  welcome_message    text,
  assigned_module_ids uuid[] not null default '{}',  -- training pre-assignment (audit F-106)
  created_at         timestamptz not null default now()
);

comment on column public.user_invitations.assigned_module_ids is
  'Onboarding modules pre-assigned at bulk-invite time (audit F-106). Not FK-enforced (array).';

-- ── soft-delete views ─────────────────────────────────────────────────────────
create or replace view public.active_companies as
  select * from public.companies where deleted_at is null;

create or replace view public.active_users as
  select * from public.users where deleted_at is null;
