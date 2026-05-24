-- 0006_requests.sql
-- Requests queue (the product feature formerly mis-modeled as a "Task Module",
-- audit PA-4). A request ALWAYS has a real request_type (audit F-125/F-137).

-- ── request_types (config; NULL company_id = global) ──────────────────────────
create table if not exists public.request_types (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid references public.companies (id) on delete cascade,  -- NULL = global
  name                  text not null,
  default_assignee_role public.user_role,   -- smart default routing (audit PA-4)
  position              integer not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on column public.request_types.default_assignee_role is
  'Default role to route this request type to, e.g. Flyer Design -> marketing, Showing -> admin_tc (audit PA-4).';

drop trigger if exists set_request_types_updated_at on public.request_types;
create trigger set_request_types_updated_at
  before update on public.request_types
  for each row execute function public.set_updated_at();

-- ── requests ──────────────────────────────────────────────────────────────────
create table if not exists public.requests (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references public.companies (id) on delete cascade,
  -- ON DELETE RESTRICT + NOT NULL guarantees a real type; the "All Types"
  -- sentinel can never be persisted (audit F-125/F-137).
  request_type_id     uuid not null references public.request_types (id) on delete restrict,
  title               text not null,
  description         text,
  status              public.request_status   not null default 'pending',
  priority            public.request_priority not null default 'normal',
  created_by          uuid references public.users (id) on delete set null,
  assigned_to_user_id uuid references public.users (id) on delete set null,  -- nullable
  assigned_to_role    public.user_role,                                      -- nullable: whole-role queue
  related_deal_id     uuid references public.deals (id) on delete set null,  -- nullable
  due_date            date,   -- nullable; do NOT default to today (audit F-140)
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

comment on column public.requests.due_date is
  'Optional. Must NOT auto-default to today (audit F-140).';
comment on column public.requests.assigned_to_role is
  'When set without assigned_to_user_id, the request sits in that role''s shared queue.';

drop trigger if exists set_requests_updated_at on public.requests;
create trigger set_requests_updated_at
  before update on public.requests
  for each row execute function public.set_updated_at();

-- ── request_comments (shared requester<->assignee thread vs internal) ─────────
create table if not exists public.request_comments (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.requests (id) on delete cascade,
  user_id     uuid references public.users (id) on delete set null,
  body        text not null,
  is_internal boolean not null default false,  -- internal note vs visible to requester (audit F-129)
  created_at  timestamptz not null default now()
);

comment on column public.request_comments.is_internal is
  'true = admin/assignee-only internal note; false = part of the shared requester<->assignee thread (audit F-129).';

-- ── request_files ─────────────────────────────────────────────────────────────
create table if not exists public.request_files (
  id                uuid primary key default gen_random_uuid(),
  request_id        uuid not null references public.requests (id) on delete cascade,
  storage_path      text not null,
  original_filename text not null,
  file_size_bytes   bigint,
  content_type      text,
  uploaded_by       uuid references public.users (id) on delete set null,
  uploaded_at       timestamptz not null default now()
);

-- ── soft-delete view ──────────────────────────────────────────────────────────
create or replace view public.active_requests as
  select * from public.requests where deleted_at is null;
