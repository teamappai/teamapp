-- 0007_activity_coaching.sql
-- Daily activity funnel metrics (PA-5), agent/team goals (PA-6), coaching log.

-- ── activity_logs (one row per agent per day) ─────────────────────────────────
create table if not exists public.activity_logs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users (id) on delete cascade,
  company_id       uuid not null references public.companies (id) on delete cascade,
  log_date         date not null,
  -- Top of funnel
  door_knocks      integer not null default 0 check (door_knocks      >= 0),
  open_houses      integer not null default 0 check (open_houses      >= 0),
  conversations    integer not null default 0 check (conversations    >= 0),
  db_seller_leads  integer not null default 0 check (db_seller_leads  >= 0),
  db_buyer_leads   integer not null default 0 check (db_buyer_leads   >= 0),
  -- Appointments
  buyer_consults   integer not null default 0 check (buyer_consults   >= 0),
  listing_appts    integer not null default 0 check (listing_appts    >= 0),
  cma_deliveries   integer not null default 0 check (cma_deliveries   >= 0),
  zillow_appts_set integer not null default 0 check (zillow_appts_set >= 0),
  zillow_appts_met integer not null default 0 check (zillow_appts_met >= 0),
  -- Pipeline
  showings         integer not null default 0 check (showings         >= 0),
  offers_submitted integer not null default 0 check (offers_submitted >= 0),
  -- Explicit "I did nothing today" so zero rows are intentional, not missing.
  marked_all_zeros boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, log_date)
);

comment on table public.activity_logs is
  'Daily prospecting funnel metrics per agent (audit PA-5). Integer steppers, never text (audit F-115).';

drop trigger if exists set_activity_logs_updated_at on public.activity_logs;
create trigger set_activity_logs_updated_at
  before update on public.activity_logs
  for each row execute function public.set_updated_at();

-- ── goals (user_id NULL = team-wide; audit PA-6) ──────────────────────────────
create table if not exists public.goals (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references public.users (id) on delete cascade,  -- NULL = team-wide goal
  company_id   uuid not null references public.companies (id) on delete cascade,
  period       public.goal_period not null,
  period_start date not null,
  goal_type    public.goal_type not null,
  target_value bigint not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, period, period_start, goal_type)
);

comment on column public.goals.user_id is
  'NULL = company/team-wide goal; otherwise an individual agent goal (audit PA-6).';

-- NULLs are distinct in a UNIQUE constraint, so the constraint above does not
-- dedupe team-wide goals. This partial index closes that gap.
create unique index if not exists goals_team_unique
  on public.goals (company_id, period, period_start, goal_type)
  where user_id is null;

drop trigger if exists set_goals_updated_at on public.goals;
create trigger set_goals_updated_at
  before update on public.goals
  for each row execute function public.set_updated_at();

-- ── coaching_log_entries ──────────────────────────────────────────────────────
create table if not exists public.coaching_log_entries (
  id            uuid primary key default gen_random_uuid(),
  agent_user_id uuid not null references public.users (id) on delete cascade,
  coach_user_id uuid references public.users (id) on delete set null,
  body          text not null,
  occurred_at   timestamptz not null,            -- date AND time (audit F-110)
  is_test       boolean not null default false,  -- filter dev/test pollution (audit F-109/F-111)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on column public.coaching_log_entries.occurred_at is
  'Full timestamp of the coaching interaction; entries are groupable by day (audit F-110).';
comment on column public.coaching_log_entries.is_test is
  'Marks seeded/demo entries so they can be excluded from real coaching views (audit F-109/F-111).';

drop trigger if exists set_coaching_log_entries_updated_at on public.coaching_log_entries;
create trigger set_coaching_log_entries_updated_at
  before update on public.coaching_log_entries
  for each row execute function public.set_updated_at();
