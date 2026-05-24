-- 0004_training.sql
-- Training/onboarding: sections -> modules -> per-user progress.
-- company_id NULL on sections = global/platform-owned content (audit F-049).

-- ── training_sections ─────────────────────────────────────────────────────────
create table if not exists public.training_sections (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid references public.companies (id) on delete cascade,  -- NULL = global
  title            text not null,
  description      text,
  visible_to_roles public.user_role[] not null default '{}',  -- empty = visible to all (PA-1)
  position         integer not null default 0,                 -- drag-drop order (PA-3)
  status           public.publish_status not null default 'draft',
  created_by       uuid references public.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

comment on column public.training_sections.company_id is
  'NULL = global section owned by the platform (super_admin); otherwise company-scoped (audit F-049).';
comment on column public.training_sections.visible_to_roles is
  'Roles allowed to see this section (audit PA-1). Empty array = all roles.';

drop trigger if exists set_training_sections_updated_at on public.training_sections;
create trigger set_training_sections_updated_at
  before update on public.training_sections
  for each row execute function public.set_updated_at();

-- ── training_modules ──────────────────────────────────────────────────────────
create table if not exists public.training_modules (
  id                        uuid primary key default gen_random_uuid(),
  section_id                uuid not null references public.training_sections (id) on delete cascade,
  title                     text not null,
  description               text,
  content                   jsonb not null default '[]'::jsonb,
  position                  integer not null default 0,        -- order within section (PA-3)
  estimated_minutes         integer,                           -- duration (audit F-070)
  recommended_timeline_days integer,                           -- deadline window (audit F-070)
  status                    public.publish_status not null default 'draft',
  visible_to_roles          public.user_role[] not null default '{}',  -- override; empty = inherit section
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  deleted_at                timestamptz
);

comment on column public.training_modules.content is
  $$Ordered array of content blocks (JSONB). Each block: {"type": <kind>, ...}.
Block kinds:
  heading         {"type":"heading","level":1-3,"text":"..."}
  paragraph       {"type":"paragraph","text":"..."}
  link            {"type":"link","url":"...","label":"..."}            -- real anchors (audit F-066)
  video_embed     {"type":"video_embed","provider":"youtube|vimeo","url":"..."}  -- (audit F-069 / SR-6)
  image           {"type":"image","url":"...","alt":"..."}
  file_attachment {"type":"file_attachment","storage_path":"...","filename":"...","size_bytes":N}
  callout         {"type":"callout","variant":"info|warning|tip","text":"..."}$$;
comment on column public.training_modules.estimated_minutes is
  'Time to complete, in minutes (a DURATION). Distinct from recommended_timeline_days (audit F-070).';
comment on column public.training_modules.visible_to_roles is
  'Optional per-module role override (PA-1). Empty array = inherit the parent section''s visibility.';

drop trigger if exists set_training_modules_updated_at on public.training_modules;
create trigger set_training_modules_updated_at
  before update on public.training_modules
  for each row execute function public.set_updated_at();

-- ── training_progress ─────────────────────────────────────────────────────────
create table if not exists public.training_progress (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.users (id) on delete cascade,
  module_id      uuid not null references public.training_modules (id) on delete cascade,
  status         public.progress_status not null default 'not_started',
  started_at     timestamptz,
  completed_at   timestamptz,
  last_viewed_at timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, module_id)
);

drop trigger if exists set_training_progress_updated_at on public.training_progress;
create trigger set_training_progress_updated_at
  before update on public.training_progress
  for each row execute function public.set_updated_at();

-- ── soft-delete views ─────────────────────────────────────────────────────────
create or replace view public.active_training_sections as
  select * from public.training_sections where deleted_at is null;

create or replace view public.active_training_modules as
  select * from public.training_modules where deleted_at is null;
