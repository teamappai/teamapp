-- 0020_notifications.sql
-- In-app notifications. Phase 7 uses this for training "nudges" a team_lead
-- sends to a stalled learner (PA-2). Email follow-up is a later phase (11/15);
-- for now a nudge is just a row here that the in-app surface will read.
--
-- `kind` is an open text discriminator (e.g. 'training_nudge') and `payload`
-- carries kind-specific data (section_id, days_inactive, custom_message, …).

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users (id) on delete cascade,  -- recipient
  actor_id   uuid references public.users (id) on delete set null,          -- who triggered it
  kind       text not null,
  payload    jsonb not null default '{}'::jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.notifications is
  'In-app notifications. kind is an open discriminator (e.g. training_nudge); payload holds kind-specific data (audit PA-2).';

create index if not exists notifications_user_id_created_at_idx
  on public.notifications (user_id, created_at desc);

-- Unread-badge lookups: "my notifications where read_at is null".
create index if not exists notifications_user_id_read_at_idx
  on public.notifications (user_id, read_at);

-- FK lookup support (who sent what).
create index if not exists notifications_actor_id_idx
  on public.notifications (actor_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table public.notifications enable row level security;

-- Read your own notifications; managers/super_admin may read a member's.
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select to authenticated
  using (
    public.is_super_admin()
    or user_id = auth.uid()
    or exists (
      select 1 from public.users tu
      where tu.id = notifications.user_id
        and public.can_manage_company(tu.company_id)
    )
  );

-- Create a notification for yourself, or (manager/super_admin) for a member of
-- a company you manage. `actor_id`, when set, must be the caller.
drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications for insert to authenticated
  with check (
    (actor_id is null or actor_id = auth.uid())
    and (
      public.is_super_admin()
      or user_id = auth.uid()
      or exists (
        select 1 from public.users tu
        where tu.id = notifications.user_id
          and public.can_manage_company(tu.company_id)
      )
    )
  );

-- Mark your own notifications read (or super_admin).
drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications for update to authenticated
  using (public.is_super_admin() or user_id = auth.uid())
  with check (public.is_super_admin() or user_id = auth.uid());

drop policy if exists notifications_delete on public.notifications;
create policy notifications_delete on public.notifications for delete to authenticated
  using (public.is_super_admin() or user_id = auth.uid());
