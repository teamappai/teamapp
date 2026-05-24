-- 0005_deals.sql
-- Deals (transactions) plus configurable types/stages, files, AI extractions,
-- and a per-deal activity log. Money is stored as BIGINT cents (never float).

-- ── deal_types (config; NULL company_id = global) ─────────────────────────────
create table if not exists public.deal_types (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies (id) on delete cascade,  -- NULL = global
  name       text not null,
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_deal_types_updated_at on public.deal_types;
create trigger set_deal_types_updated_at
  before update on public.deal_types
  for each row execute function public.set_updated_at();

-- ── deal_stages (config; NULL company_id = global) ────────────────────────────
create table if not exists public.deal_stages (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid references public.companies (id) on delete cascade,  -- NULL = global
  name             text not null,
  position         integer not null default 0,
  color            text,
  is_terminal_won  boolean not null default false,
  is_terminal_lost boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.deal_stages is
  'Real-estate-native pipeline stages (audit F-013/F-059/PA-7). Terminal flags mark won/lost.';

drop trigger if exists set_deal_stages_updated_at on public.deal_stages;
create trigger set_deal_stages_updated_at
  before update on public.deal_stages
  for each row execute function public.set_updated_at();

-- Seed the global default stage set once (idempotent: only when no globals exist).
insert into public.deal_stages (name, position, color, is_terminal_won, is_terminal_lost)
select v.name, v.position, v.color, v.won, v.lost
from (values
  ('Submitted',      0, '#94a3b8', false, false),
  ('Under Review',   1, '#64748b', false, false),
  ('Active',         2, '#3b82f6', false, false),
  ('Pending',        3, '#f59e0b', false, false),
  ('Under Contract', 4, '#8b5cf6', false, false),
  ('Closed',         5, '#22c55e', true,  false),
  ('Lost/Trash',     6, '#ef4444', false, true)
) as v(name, position, color, won, lost)
where not exists (
  select 1 from public.deal_stages where company_id is null
);

-- ── deals ─────────────────────────────────────────────────────────────────────
create table if not exists public.deals (
  id                         uuid primary key default gen_random_uuid(),
  company_id                 uuid not null references public.companies (id) on delete cascade,
  deal_type_id               uuid references public.deal_types (id) on delete set null,
  stage_id                   uuid references public.deal_stages (id) on delete set null,
  representing                public.deal_representing,  -- buyer/seller/dual (audit F-081)
  property_address           text,
  property_city              text,
  property_state             text,
  property_zip               text,
  client_first_name          text,
  client_last_name           text,
  client_email               text,
  client_phone               text,
  sales_price_cents          bigint check (sales_price_cents is null or sales_price_cents >= 0),
  gci_cents                  bigint check (gci_cents is null or gci_cents >= 0),
  commission_pct             numeric(5,3),
  listing_agent_id           uuid references public.users (id) on delete set null,
  co_listing_agent_id        uuid references public.users (id) on delete set null,
  buyer_agent_id             uuid references public.users (id) on delete set null,
  listing_broker             text,
  buy_side_broker            text,
  rpa_signed_date            date,        -- anchor for contingency math (audit SR-7)
  inspection_contingency_days integer,    -- number + unit, not free text (audit F-082)
  appraisal_contingency_days  integer,
  loan_contingency_days       integer,
  close_date                 date,
  public_share_link_enabled  boolean not null default false,  -- (audit F-029)
  created_by                 uuid references public.users (id) on delete set null,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  deleted_at                 timestamptz
);

comment on column public.deals.rpa_signed_date is
  'Residential Purchase Agreement signing date. Contingency windows count from here, not created_at (audit SR-7).';
comment on column public.deals.public_share_link_enabled is
  'Whether a public client-facing share link is enabled (renamed from ambiguous "Shared the link", audit F-029).';

drop trigger if exists set_deals_updated_at on public.deals;
create trigger set_deals_updated_at
  before update on public.deals
  for each row execute function public.set_updated_at();

-- ── deal_files (one-to-many; audit SR-2) ──────────────────────────────────────
create table if not exists public.deal_files (
  id                uuid primary key default gen_random_uuid(),
  deal_id           uuid not null references public.deals (id) on delete cascade,
  storage_path      text not null,
  original_filename text not null,
  file_size_bytes   bigint,
  content_type      text,
  uploaded_by       uuid references public.users (id) on delete set null,
  uploaded_at       timestamptz not null default now()
);

comment on table public.deal_files is
  'Multiple files per deal (contract, counters, addenda, disclosures) — audit SR-2.';

-- ── deal_ai_extractions (provenance for AI-extracted fields; audit SR-1) ──────
create table if not exists public.deal_ai_extractions (
  id               uuid primary key default gen_random_uuid(),
  deal_file_id     uuid not null references public.deal_files (id) on delete cascade,
  model_name       text,
  raw_response     jsonb,
  extracted_fields jsonb,
  confirmed_at     timestamptz,
  confirmed_by     uuid references public.users (id) on delete set null,
  created_at       timestamptz not null default now()
);

comment on table public.deal_ai_extractions is
  'AI contract-extraction results kept for user audit/correction before save (audit SR-1).';

-- ── deal_activity (append-only audit trail) ──────────────────────────────────
create table if not exists public.deal_activity (
  id         uuid primary key default gen_random_uuid(),
  deal_id    uuid not null references public.deals (id) on delete cascade,
  user_id    uuid references public.users (id) on delete set null,
  event_type public.deal_activity_event not null,
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ── soft-delete view ──────────────────────────────────────────────────────────
create or replace view public.active_deals as
  select * from public.deals where deleted_at is null;
