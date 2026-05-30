-- 0022_requests_phase9.sql
-- Phase 9 — Requests feature (replaces the old "Task Module").
--   1. request_types.category  — coarse workflow class that drives smart routing
--      defaults and future reporting (agent_support / field_work /
--      transaction_admin / other).
--   2. request_status_changes  — append-only audit trail of every status
--      transition (audit F-127 / F-141), visibility inherited from the parent
--      request.
-- Notifications (in-app bell) reuse the existing public.notifications table
-- (migration 0020); no schema change needed here.

-- ── request_types.category ────────────────────────────────────────────────────
alter table public.request_types
  add column if not exists category text not null default 'other';

do $$ begin
  alter table public.request_types
    add constraint request_types_category_ck
    check (category in ('agent_support', 'field_work', 'transaction_admin', 'other'));
exception when duplicate_object then null; end $$;

comment on column public.request_types.category is
  'Coarse workflow class: agent_support (agent -> admin/marketing), field_work '
  '(team_lead/admin -> agent), transaction_admin (admin <-> agent), or other. '
  'Drives smart-assignment defaults on the create form (Phase 9 / PA-4).';

-- Backfill existing rows from their default routing role. New seeds set the
-- column explicitly; this only matters for types created before this migration.
update public.request_types
   set category = case default_assignee_role
                    when 'marketing' then 'agent_support'
                    when 'admin_tc'  then 'transaction_admin'
                    when 'agent'     then 'field_work'
                    else 'other'
                  end
 where category = 'other'
   and default_assignee_role is not null;

-- ── request_status_changes (audit trail) ──────────────────────────────────────
create table if not exists public.request_status_changes (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.requests (id) on delete cascade,
  from_status text,                       -- null on the very first transition
  to_status   text not null,
  changed_by  uuid references public.users (id) on delete set null,
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists request_status_changes_request_id_created_at_idx
  on public.request_status_changes (request_id, created_at desc);

comment on table public.request_status_changes is
  'Append-only audit of request status transitions (audit F-127). One row per '
  'advance/reject; visibility inherits from the parent request.';

-- ── RLS: status changes inherit visibility from the parent request ────────────
alter table public.request_status_changes enable row level security;

drop policy if exists request_status_changes_select on public.request_status_changes;
create policy request_status_changes_select on public.request_status_changes
  for select to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.requests r
      where r.id = request_status_changes.request_id
        and public.is_company_member(r.company_id)
    )
  );

-- The audit row is stamped with the acting user; only company members who can
-- already see the request may append one.
drop policy if exists request_status_changes_insert on public.request_status_changes;
create policy request_status_changes_insert on public.request_status_changes
  for insert to authenticated
  with check (
    (changed_by is null or changed_by = auth.uid())
    and exists (
      select 1 from public.requests r
      where r.id = request_status_changes.request_id
        and public.is_company_member(r.company_id)
    )
  );

-- Append-only: no update/delete policies (only super_admin via service role).

-- ── helpful request indexes for the list/queue queries ───────────────────────
create index if not exists requests_company_id_idx
  on public.requests (company_id) where deleted_at is null;
create index if not exists requests_assigned_to_user_id_idx
  on public.requests (assigned_to_user_id) where deleted_at is null;
create index if not exists requests_created_by_idx
  on public.requests (created_by) where deleted_at is null;
