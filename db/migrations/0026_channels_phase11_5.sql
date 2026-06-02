-- 0026_channels_phase11_5.sql
-- Phase 11.5 (Channels — within-company team chat). Builds on the Phase 1
-- messaging schema (0008), its RLS (0011), and Phase 11 (0024). Channels are the
-- third message_threads.type ('channel' has existed in the enum since 0002);
-- this migration adds the columns, constraints, system-message support, the
-- default #general channel, and the channel-aware RLS that the UI needs.
--
-- STRICT COMPANY BOUNDARY: every channel belongs to exactly one company. A user
-- only ever sees channels where channel.company_id = their company_id — public
-- channels are browsable within the company, private channels only to members.
-- There is no cross-company discovery anywhere.

-- ════════════════════════════════════════════════════════════════════════════
-- 1. Channel columns on message_threads (only meaningful for type='channel')
-- ════════════════════════════════════════════════════════════════════════════
alter table public.message_threads
  add column if not exists visibility text;

do $$ begin
  alter table public.message_threads
    add constraint message_threads_visibility_ck
    check (visibility is null or visibility in ('public', 'private'));
exception when duplicate_object then null; end $$;

alter table public.message_threads
  add column if not exists description text;

do $$ begin
  alter table public.message_threads
    add constraint message_threads_description_length_ck
    check (description is null or length(description) between 1 and 500);
exception when duplicate_object then null; end $$;

-- Channels MUST carry a name (1..80 chars); DMs/groups keep a nullable name.
do $$ begin
  alter table public.message_threads
    add constraint message_threads_channel_name_ck
    check (
      type <> 'channel'
      or (name is not null and length(name) between 1 and 80)
    );
exception when duplicate_object then null; end $$;

-- Channels MUST declare a visibility; DMs/groups must not.
do $$ begin
  alter table public.message_threads
    add constraint message_threads_channel_visibility_ck
    check (
      (type = 'channel' and visibility is not null)
      or (type <> 'channel' and visibility is null)
    );
exception when duplicate_object then null; end $$;

comment on column public.message_threads.visibility is
  'Channel access: public (browsable + freely joinable in-company) or private (invite-only). NULL for direct/group threads.';
comment on column public.message_threads.description is
  'Optional channel topic/description (1..500 chars). NULL for direct/group threads or undescribed channels.';

-- ════════════════════════════════════════════════════════════════════════════
-- 2. System messages (join/leave/add/remove notices — Decision 6)
-- ════════════════════════════════════════════════════════════════════════════
-- System messages are real rows with sender_id NULL and is_system=true. They are
-- not editable/deletable/reactable by users and render as muted centered text.
-- sender_id has been nullable since 0008 (on delete set null), so we only add the
-- flag + an invariant that ties the two together. The check is one-directional so
-- it can never fail against existing data (which is all is_system=false).
alter table public.messages
  add column if not exists is_system boolean not null default false;

do $$ begin
  alter table public.messages
    add constraint messages_system_sender_ck
    check (not is_system or sender_id is null);
exception when duplicate_object then null; end $$;

comment on column public.messages.is_system is
  'True for system notices (channel join/leave/add/remove). Such rows have sender_id NULL and render as muted centered text (Decision 6).';

-- ════════════════════════════════════════════════════════════════════════════
-- 3. Channel browse index (per-company list of channels by visibility)
-- ════════════════════════════════════════════════════════════════════════════
create index if not exists idx_message_threads_company_channels
  on public.message_threads (company_id, type, visibility)
  where type = 'channel';

-- ════════════════════════════════════════════════════════════════════════════
-- 4. #general provisioning
-- ════════════════════════════════════════════════════════════════════════════
-- Helper: can the caller create/manage channels? team_lead + admin_tc only
-- (Decision 2/4). SECURITY DEFINER so reading the caller's role bypasses RLS.
create or replace function public.can_manage_channels()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.auth_user_role() in ('team_lead', 'admin_tc');
$$;
grant execute on function public.can_manage_channels() to authenticated, anon;

-- Trigger: every newly-created company gets a #general channel in the SAME
-- transaction (Decision 3). At company-insert time there are no users yet, so
-- members are added as users are provisioned (invite-accept auto-joins #general).
-- created_by is left NULL (back-filled conceptually by leadership later). Guarded
-- with NOT EXISTS so it is safe even if ever invoked twice.
create or replace function public.tg_create_general_channel()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.message_threads t
    where t.company_id = new.id
      and t.type = 'channel'
      and lower(t.name) = 'general'
  ) then
    insert into public.message_threads (company_id, type, name, visibility, description)
    values (new.id, 'channel', 'general', 'public',
            'Company-wide channel for everyone');
  end if;
  return new;
end;
$$;

drop trigger if exists create_general_channel on public.companies;
create trigger create_general_channel
  after insert on public.companies
  for each row execute function public.tg_create_general_channel();

-- Backfill #general for every existing (non-deleted) company and add all of its
-- active users as members. Idempotent: skips companies that already have one.
do $$
declare
  comp record;
  new_thread_id uuid;
  lead_id uuid;
begin
  for comp in select id from public.companies where deleted_at is null loop
    if not exists (
      select 1 from public.message_threads
      where company_id = comp.id
        and type = 'channel'
        and lower(name) = 'general'
    ) then
      select id into lead_id
      from public.users
      where company_id = comp.id and role = 'team_lead'
      limit 1;

      insert into public.message_threads
        (company_id, type, name, visibility, description, created_by)
      values (comp.id, 'channel', 'general', 'public',
              'Company-wide channel for everyone', lead_id)
      returning id into new_thread_id;

      insert into public.message_thread_participants (thread_id, user_id, joined_at)
      select new_thread_id, id, now()
      from public.users
      where company_id = comp.id and deleted_at is null;
    end if;
  end loop;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. Channel-aware RLS (replaces the Phase 1 message_threads policies)
-- ════════════════════════════════════════════════════════════════════════════
-- DMs/groups keep participant-scoped behavior. Channels add: public channels are
-- SELECT-able by anyone in the same company (so they can be browsed + joined);
-- private channels stay member-only. INSERT/UPDATE/DELETE of channels is limited
-- to team_lead/admin_tc within the company. The participant/messages/reactions
-- policies from 0011 already key on is_thread_participant, which works unchanged
-- for channel members. Interactive channel writes go through the service client
-- (server actions) with explicit checks; these policies are defense-in-depth.

drop policy if exists message_threads_select on public.message_threads;
create policy message_threads_select on public.message_threads for select to authenticated
  using (
    public.is_super_admin()
    or public.is_thread_participant(id)
    or (
      type = 'channel'
      and visibility = 'public'
      and company_id = public.auth_user_company_id()
    )
  );

drop policy if exists message_threads_insert on public.message_threads;
create policy message_threads_insert on public.message_threads for insert to authenticated
  with check (
    public.is_super_admin()
    or (
      company_id = public.auth_user_company_id()
      and created_by = auth.uid()
      and (type <> 'channel' or public.can_manage_channels())
    )
  );

drop policy if exists message_threads_modify on public.message_threads;
create policy message_threads_modify on public.message_threads for update to authenticated
  using (
    public.is_super_admin()
    or created_by = auth.uid()
    or (
      type = 'channel'
      and company_id = public.auth_user_company_id()
      and public.can_manage_channels()
    )
  )
  with check (
    public.is_super_admin()
    or created_by = auth.uid()
    or (
      type = 'channel'
      and company_id = public.auth_user_company_id()
      and public.can_manage_channels()
    )
  );

drop policy if exists message_threads_delete on public.message_threads;
create policy message_threads_delete on public.message_threads for delete to authenticated
  using (
    public.is_super_admin()
    or created_by = auth.uid()
    or (
      type = 'channel'
      and company_id = public.auth_user_company_id()
      and public.can_manage_channels()
    )
  );
