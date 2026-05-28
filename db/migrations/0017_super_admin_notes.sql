-- 0017_super_admin_notes.sql
-- Phase 5 (Super-Admin console). Two things:
--   1) super_admin_notes — freeform operator notes about a customer company.
--      super_admin-visible ONLY; never surfaced to a company's own members.
--   2) A reserved-name guard on companies so the "All Companies" filter
--      sentinel (and the em-dash / empty placeholders) can never be persisted
--      as real company data (audit F-050).

-- ── super_admin_notes ─────────────────────────────────────────────────────────
create table if not exists public.super_admin_notes (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  body       text not null,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.super_admin_notes is
  'Platform-operator notes about a customer company. super_admin-only (audit CR-4); never shown to company members. Soft-deleted via deleted_at.';

-- RLS: only super_admin may read or write. The service-role client (used by the
-- admin console) bypasses RLS, but this keeps the table locked down for any
-- session-scoped (anon-key) access.
alter table public.super_admin_notes enable row level security;

drop policy if exists super_admin_notes_select on public.super_admin_notes;
create policy super_admin_notes_select on public.super_admin_notes
  for select to authenticated
  using (public.is_super_admin());

drop policy if exists super_admin_notes_write on public.super_admin_notes;
create policy super_admin_notes_write on public.super_admin_notes
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create index if not exists super_admin_notes_company_idx
  on public.super_admin_notes (company_id)
  where deleted_at is null;

-- ── companies reserved-name guard (audit F-050) ───────────────────────────────
-- Reject the "All Companies" filter sentinel, the em-dash placeholder, and the
-- empty/whitespace string as a stored company name. Validation also enforces
-- this at the app layer (lib/validations/company.ts); this is the backstop so
-- the sentinel can never become a row no matter how the insert is issued.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'companies_name_not_reserved_ck'
      and conrelid = 'public.companies'::regclass
  ) then
    alter table public.companies
      add constraint companies_name_not_reserved_ck
      check (
        length(btrim(name)) > 0
        and lower(btrim(name)) <> 'all companies'
        and btrim(name) <> '—'
        and btrim(name) <> '-'
      );
  end if;
end $$;
