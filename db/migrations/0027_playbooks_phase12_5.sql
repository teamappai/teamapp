-- 0027_playbooks_phase12_5.sql
-- Phase 12.5 — Curated Playbook Library.
--
-- TeamApp is the SOLE publisher of playbooks: curated bundles of training
-- sections + modules that customers browse and INSTALL into their own
-- workspace. Installing deep-copies the playbook_* content into the customer's
-- training_* tables (with their company_id); from then on it is the customer's
-- editable content (Phase 6 Management Hub UX). There is no creator role and no
-- update-flow back from the library.
--
-- Playbook content lives in separate playbook_* tables so it is fully isolated
-- from customer training_* content. Install caps differentiate plan tiers
-- (Launch = 2 concurrent installs; Pro/Enterprise = unlimited) and are enforced
-- server-side at install time.

-- ════════════════════════════════════════════════════════════════════════════
-- 1. playbooks — TeamApp-owned catalogue (no company_id)
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists public.playbooks (
  id                         uuid primary key default gen_random_uuid(),
  slug                       text unique not null,
  title                      text not null,
  description                text,
  category                   text not null,
  icon_name                  text,          -- lucide icon name (e.g. "Award")
  cover_gradient             text,          -- tailwind gradient (e.g. "from-amber-500 to-orange-600")
  credit_text                text,          -- e.g. "Created by Sarah Chen, Chen Luxury Group"
  status                     text not null default 'draft'
                               check (status in ('draft', 'published', 'archived')),
  recommended_for_onboarding boolean not null default false,
  install_count              integer not null default 0,  -- denormalized for list views
  created_at                 timestamptz not null default now(),
  published_at               timestamptz,
  updated_at                 timestamptz not null default now(),
  created_by_user_id         uuid references public.users (id) on delete set null
);

comment on table public.playbooks is
  'TeamApp-owned curated training playbooks. No company_id — these are platform content, deep-copied into a customer''s training_* tables on install (Phase 12.5).';

create index if not exists idx_playbooks_status on public.playbooks (status);
create index if not exists idx_playbooks_category on public.playbooks (category)
  where status = 'published';
create index if not exists idx_playbooks_onboarding on public.playbooks (recommended_for_onboarding)
  where recommended_for_onboarding = true and status = 'published';

drop trigger if exists set_playbooks_updated_at on public.playbooks;
create trigger set_playbooks_updated_at
  before update on public.playbooks
  for each row execute function public.set_updated_at();

-- ════════════════════════════════════════════════════════════════════════════
-- 2. playbook_training_sections (mirrors training_sections)
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists public.playbook_training_sections (
  id                        uuid primary key default gen_random_uuid(),
  playbook_id               uuid not null references public.playbooks (id) on delete cascade,
  position                  integer not null,
  title                     text not null,
  description               text,
  visible_to_roles          public.user_role[] not null
                              default array['agent', 'admin_tc', 'marketing', 'team_lead']::public.user_role[],
  estimated_minutes         integer,
  recommended_timeline_days integer,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
create index if not exists idx_playbook_sections_playbook
  on public.playbook_training_sections (playbook_id, position);

drop trigger if exists set_playbook_sections_updated_at on public.playbook_training_sections;
create trigger set_playbook_sections_updated_at
  before update on public.playbook_training_sections
  for each row execute function public.set_updated_at();

-- ════════════════════════════════════════════════════════════════════════════
-- 3. playbook_training_modules (mirrors training_modules; same block schema)
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists public.playbook_training_modules (
  id                  uuid primary key default gen_random_uuid(),
  playbook_section_id uuid not null references public.playbook_training_sections (id) on delete cascade,
  position            integer not null,
  title               text not null,
  description         text,
  content             jsonb not null default '[]'::jsonb,  -- same block schema as training_modules
  estimated_minutes   integer,
  visible_to_roles    public.user_role[],                  -- nullable override (empty/null = inherit)
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists idx_playbook_modules_section
  on public.playbook_training_modules (playbook_section_id, position);

drop trigger if exists set_playbook_modules_updated_at on public.playbook_training_modules;
create trigger set_playbook_modules_updated_at
  before update on public.playbook_training_modules
  for each row execute function public.set_updated_at();

-- ════════════════════════════════════════════════════════════════════════════
-- 4. playbook_installs — which companies installed which playbooks
-- ════════════════════════════════════════════════════════════════════════════
-- Soft-delete pattern: uninstalled_at NULL = currently installed (occupies a
-- cap slot). Uninstall sets uninstalled_at and frees the slot, but leaves the
-- copied training content in place (Decision 5).
create table if not exists public.playbook_installs (
  id                   uuid primary key default gen_random_uuid(),
  playbook_id          uuid not null references public.playbooks (id) on delete restrict,
  company_id           uuid not null references public.companies (id) on delete cascade,
  installed_at         timestamptz not null default now(),
  installed_by_user_id uuid references public.users (id) on delete set null,
  uninstalled_at       timestamptz
);

-- A company may have at most one ACTIVE install of a given playbook; reinstalls
-- after an uninstall are allowed (the old row keeps its uninstalled_at).
create unique index if not exists playbook_installs_active_unique
  on public.playbook_installs (playbook_id, company_id)
  where uninstalled_at is null;
create index if not exists idx_playbook_installs_company
  on public.playbook_installs (company_id) where uninstalled_at is null;
create index if not exists idx_playbook_installs_playbook
  on public.playbook_installs (playbook_id) where uninstalled_at is null;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. training_section_source — link copied training_sections back to the source
-- ════════════════════════════════════════════════════════════════════════════
-- Lets us identify "installed content" within a customer's workspace. ON DELETE
-- NO ACTION on the source so a published playbook section can't vanish out from
-- under an install record; install rows cascade on uninstall-cleanup though.
create table if not exists public.training_section_source (
  training_section_id        uuid primary key references public.training_sections (id) on delete cascade,
  playbook_install_id        uuid not null references public.playbook_installs (id) on delete cascade,
  source_playbook_section_id uuid not null references public.playbook_training_sections (id) on delete no action
);
create index if not exists idx_training_section_source_install
  on public.training_section_source (playbook_install_id);

-- ════════════════════════════════════════════════════════════════════════════
-- 6. RLS
-- ════════════════════════════════════════════════════════════════════════════
alter table public.playbooks                  enable row level security;
alter table public.playbook_training_sections enable row level security;
alter table public.playbook_training_modules  enable row level security;
alter table public.playbook_installs          enable row level security;
alter table public.training_section_source    enable row level security;

-- ── playbooks: published readable by everyone; super_admin sees all + writes ──
drop policy if exists playbooks_select on public.playbooks;
create policy playbooks_select on public.playbooks for select to authenticated
  using (status = 'published' or public.is_super_admin());

drop policy if exists playbooks_insert on public.playbooks;
create policy playbooks_insert on public.playbooks for insert to authenticated
  with check (public.is_super_admin());

drop policy if exists playbooks_update on public.playbooks;
create policy playbooks_update on public.playbooks for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists playbooks_delete on public.playbooks;
create policy playbooks_delete on public.playbooks for delete to authenticated
  using (public.is_super_admin());

-- ── playbook sections: super_admin always; customers ONLY once their company
--    has an active install (this enforces metadata-only preview before install).
drop policy if exists playbook_sections_select on public.playbook_training_sections;
create policy playbook_sections_select on public.playbook_training_sections for select to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.playbook_installs pi
      where pi.playbook_id = playbook_training_sections.playbook_id
        and pi.company_id = public.auth_user_company_id()
        and pi.uninstalled_at is null
    )
  );

drop policy if exists playbook_sections_insert on public.playbook_training_sections;
create policy playbook_sections_insert on public.playbook_training_sections for insert to authenticated
  with check (public.is_super_admin());
drop policy if exists playbook_sections_update on public.playbook_training_sections;
create policy playbook_sections_update on public.playbook_training_sections for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
drop policy if exists playbook_sections_delete on public.playbook_training_sections;
create policy playbook_sections_delete on public.playbook_training_sections for delete to authenticated
  using (public.is_super_admin());

-- ── playbook modules: same shape, scoped through the parent section's playbook.
drop policy if exists playbook_modules_select on public.playbook_training_modules;
create policy playbook_modules_select on public.playbook_training_modules for select to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1
      from public.playbook_training_sections pts
      join public.playbook_installs pi on pi.playbook_id = pts.playbook_id
      where pts.id = playbook_training_modules.playbook_section_id
        and pi.company_id = public.auth_user_company_id()
        and pi.uninstalled_at is null
    )
  );

drop policy if exists playbook_modules_insert on public.playbook_training_modules;
create policy playbook_modules_insert on public.playbook_training_modules for insert to authenticated
  with check (public.is_super_admin());
drop policy if exists playbook_modules_update on public.playbook_training_modules;
create policy playbook_modules_update on public.playbook_training_modules for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
drop policy if exists playbook_modules_delete on public.playbook_training_modules;
create policy playbook_modules_delete on public.playbook_training_modules for delete to authenticated
  using (public.is_super_admin());

-- ── installs: customers see their own company's installs; super_admin sees all.
--    Writes (install/uninstall) go through the service client in server actions
--    after a server-side role + cap check, so no customer write policy is added.
drop policy if exists playbook_installs_select on public.playbook_installs;
create policy playbook_installs_select on public.playbook_installs for select to authenticated
  using (
    public.is_super_admin()
    or company_id = public.auth_user_company_id()
  );

-- ── training_section_source: visible to the owning company + super_admin.
drop policy if exists training_section_source_select on public.training_section_source;
create policy training_section_source_select on public.training_section_source for select to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.training_sections ts
      where ts.id = training_section_source.training_section_id
        and ts.company_id = public.auth_user_company_id()
    )
  );
