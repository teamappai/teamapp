-- 0028_dashboards_phase13.sql
-- Phase 13 (Role dashboards + drill-down + coaching note replies). Two concerns:
--   1. coaching_log_replies — turns a coaching note into a two-way conversation.
--      Scoped to the SUBJECT agent + team_lead + super_admin (admin_tc is
--      intentionally excluded from reply threads per Decision 3). The base
--      coaching table is public.coaching_log_entries (agent_user_id = subject,
--      coach_user_id = author); it has no company_id of its own, so company
--      scoping is derived through the subject agent's users row.
--   2. A consolidated activity-feed source (view + SECURITY DEFINER function)
--      so each dashboard can pull a single role-filtered event stream. Columns
--      are mapped to the REAL schema (sales_price_cents, stage via deal_stages,
--      activity_logs HomeReady metric set, request_types.default_assignee_role
--      for marketing-typed filtering) — NOT the idealized names in the spec.

-- ════════════════════════════════════════════════════════════════════════════
-- 1. coaching_log_replies
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.coaching_log_replies (
  id                     uuid primary key default gen_random_uuid(),
  coaching_log_entry_id  uuid not null references public.coaching_log_entries (id) on delete cascade,
  author_user_id         uuid not null references public.users (id) on delete cascade,
  body                   text not null check (length(body) between 1 and 5000),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

comment on table public.coaching_log_replies is
  'Replies on a coaching note (Phase 13). Visible to the subject agent + team_lead + super_admin only; admin_tc is excluded from reply threads (Decision 3).';

create index if not exists coaching_replies_entry_idx
  on public.coaching_log_replies (coaching_log_entry_id, created_at);
create index if not exists coaching_replies_author_idx
  on public.coaching_log_replies (author_user_id);

drop trigger if exists set_coaching_log_replies_updated_at on public.coaching_log_replies;
create trigger set_coaching_log_replies_updated_at
  before update on public.coaching_log_replies
  for each row execute function public.set_updated_at();

alter table public.coaching_log_replies enable row level security;

-- SELECT: super_admin sees all; otherwise the viewer must be in the subject
-- agent's company AND be either the subject agent themselves or a team_lead.
-- admin_tc is deliberately NOT granted visibility, even on notes they authored
-- (Decision 3 / criterion 55-56).
drop policy if exists coaching_replies_select on public.coaching_log_replies;
create policy coaching_replies_select on public.coaching_log_replies
  for select to authenticated using (
    public.is_super_admin()
    or exists (
      select 1
      from public.coaching_log_entries cl
      join public.users agent on agent.id = cl.agent_user_id
      where cl.id = coaching_log_replies.coaching_log_entry_id
        and agent.company_id = public.auth_user_company_id()
        and (
          cl.agent_user_id = auth.uid()
          or (select u.role from public.users u where u.id = auth.uid()) = 'team_lead'
        )
    )
  );

-- INSERT: the author must be the caller, the caller must be allowed to view the
-- thread (subject agent or team_lead/super_admin), and the note must belong to
-- the caller's company.
drop policy if exists coaching_replies_insert on public.coaching_log_replies;
create policy coaching_replies_insert on public.coaching_log_replies
  for insert to authenticated with check (
    author_user_id = auth.uid()
    and (
      public.is_super_admin()
      or exists (
        select 1
        from public.coaching_log_entries cl
        join public.users agent on agent.id = cl.agent_user_id
        where cl.id = coaching_log_replies.coaching_log_entry_id
          and agent.company_id = public.auth_user_company_id()
          and (
            cl.agent_user_id = auth.uid()
            or (select u.role from public.users u where u.id = auth.uid()) = 'team_lead'
          )
      )
    )
  );

-- Authors may edit/delete their own replies; super_admin may moderate any.
drop policy if exists coaching_replies_modify on public.coaching_log_replies;
create policy coaching_replies_modify on public.coaching_log_replies
  for update to authenticated
  using (public.is_super_admin() or author_user_id = auth.uid())
  with check (public.is_super_admin() or author_user_id = auth.uid());

drop policy if exists coaching_replies_delete on public.coaching_log_replies;
create policy coaching_replies_delete on public.coaching_log_replies
  for delete to authenticated
  using (public.is_super_admin() or author_user_id = auth.uid());

-- ════════════════════════════════════════════════════════════════════════════
-- 2. Consolidated activity-feed source
--    v_activity_feed_events unions deal/request/training/activity events with a
--    normalized (event_type, actor_user_id, company_id, occurred_at, payload)
--    shape. activity_feed_for_user() applies per-role scoping (Decision 10).
-- ════════════════════════════════════════════════════════════════════════════

create or replace view public.v_activity_feed_events
with (security_invoker = true) as
-- Deal created
select
  'deal_created'::text as event_type,
  d.id                 as event_id,
  d.created_by         as actor_user_id,
  d.company_id,
  d.created_at         as occurred_at,
  jsonb_build_object(
    'deal_id', d.id,
    'property', d.property_address,
    'value_cents', d.sales_price_cents,
    'representing', d.representing,
    'stage', s.name
  ) as payload,
  null::text as request_assignee_role
from public.deals d
left join public.deal_stages s on s.id = d.stage_id
where d.deleted_at is null and d.is_draft = false

union all
-- Deal closed (terminal-won stage)
select
  'deal_closed'::text,
  d.id,
  d.created_by,
  d.company_id,
  coalesce(d.close_date::timestamptz, d.updated_at) as occurred_at,
  jsonb_build_object(
    'deal_id', d.id,
    'property', d.property_address,
    'value_cents', d.sales_price_cents,
    'gci_cents', d.gci_cents,
    'representing', d.representing
  ),
  null::text
from public.deals d
join public.deal_stages s on s.id = d.stage_id
where d.deleted_at is null and d.is_draft = false and s.is_terminal_won = true

union all
-- Request created
select
  'request_created'::text,
  r.id,
  r.created_by,
  r.company_id,
  r.created_at,
  jsonb_build_object(
    'request_id', r.id,
    'title', r.title,
    'type', rt.name,
    'status', r.status
  ),
  rt.default_assignee_role::text
from public.requests r
join public.request_types rt on rt.id = r.request_type_id
where r.deleted_at is null

union all
-- Training module completed
select
  'training_completed'::text,
  tp.id,
  tp.user_id,
  u.company_id,
  tp.completed_at,
  jsonb_build_object(
    'module_id', tp.module_id,
    'module_title', tm.title,
    'section_title', ts.title
  ),
  null::text
from public.training_progress tp
join public.training_modules tm on tm.id = tp.module_id
join public.training_sections ts on ts.id = tm.section_id
join public.users u on u.id = tp.user_id
where tp.status = 'completed' and tp.completed_at is not null

union all
-- Daily activity logged (worked days only)
select
  'activity_logged'::text,
  al.id,
  al.user_id,
  al.company_id,
  al.log_date::timestamptz,
  jsonb_build_object(
    'log_date', al.log_date,
    'total_activities', (
      al.door_knocks + al.open_houses + al.conversations
        + al.seller_leads_added + al.buyer_leads_added + al.pqs
        + al.buyer_consults + al.listing_appts + al.cma_deliveries
        + al.zillow_appts_set + al.zillow_appts_met
        + al.showings + al.listings_signed + al.buyer_agreements_signed
        + al.offers_submitted
    )
  ),
  null::text
from public.activity_logs al
where al.is_off_day = false;

comment on view public.v_activity_feed_events is
  'Consolidated activity-feed event source (Phase 13). Normalized shape across deals, requests, training, and activity logs. Filtered per-role by activity_feed_for_user().';

-- Role-scoped, paginated reader. SECURITY DEFINER because it must read across
-- every event table for the whole company; it scopes to the caller''s company
-- and applies the per-role event filter internally (Decision 10). Marketing
-- sees ONLY marketing-typed request events + their own activity — never deal
-- events (F-133).
create or replace function public.activity_feed_for_user(
  p_user_id uuid,
  p_limit int default 50,
  p_offset int default 0
)
returns table (
  event_type text,
  event_id uuid,
  actor_user_id uuid,
  company_id uuid,
  occurred_at timestamptz,
  payload jsonb
)
security definer
set search_path = public
language plpgsql
as $$
declare
  v_role public.user_role;
  v_company_id uuid;
begin
  select u.role, u.company_id into v_role, v_company_id
  from public.users u where u.id = p_user_id;

  if v_company_id is null then
    return;
  end if;

  return query
  select e.event_type, e.event_id, e.actor_user_id, e.company_id, e.occurred_at, e.payload
  from public.v_activity_feed_events e
  where e.company_id = v_company_id
    and case
      -- Agents see only their own events.
      when v_role = 'agent' then e.actor_user_id = p_user_id
      -- admin_tc: any request/training/activity event + their own. No deal events.
      when v_role = 'admin_tc' then
        e.event_type in ('request_created', 'training_completed', 'activity_logged')
        or e.actor_user_id = p_user_id
      -- marketing: marketing-typed request events only + their own activity. No deals.
      when v_role = 'marketing' then
        (e.event_type = 'request_created' and e.request_assignee_role = 'marketing')
        or e.actor_user_id = p_user_id
      -- team_lead / super_admin: everything in the company.
      when v_role in ('team_lead', 'super_admin') then true
      else false
    end
  order by e.occurred_at desc nulls last
  limit p_limit offset p_offset;
end;
$$;

comment on function public.activity_feed_for_user(uuid, int, int) is
  'Role-filtered, paginated activity feed for a user (Phase 13 / Decision 10). SECURITY DEFINER: scopes to the user''s company and applies the per-role event filter.';

-- Lock down execute: authenticated users only (matches 0014 hardening posture).
revoke all on function public.activity_feed_for_user(uuid, int, int) from public;
grant execute on function public.activity_feed_for_user(uuid, int, int) to authenticated, service_role;
