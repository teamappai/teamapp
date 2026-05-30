-- 0021_deals_phase8.sql
-- Phase 8 (Deals) additions on top of the 0005 schema:
--   1. deal_stages.probability_pct — drives the Pipeline Value KPI
--      (sum of sales_price_cents × probability_pct/100 over non-terminal stages).
--   2. deals.is_draft — the stepped Add-Deal wizard creates a draft row up front
--      so files can attach across steps (deal_files.deal_id is NOT NULL); the
--      final "Submit" flips this to false. Drafts are filtered from all lists.
--   3. deal_comments — threaded per-deal discussion (mirrors request_comments,
--      plus a self-referencing parent_id for one level of replies).

-- ── deal_stages.probability_pct ───────────────────────────────────────────────
alter table public.deal_stages
  add column if not exists probability_pct integer not null default 0
    check (probability_pct between 0 and 100);

comment on column public.deal_stages.probability_pct is
  'Win probability for the Pipeline Value KPI: sum(sales_price_cents * probability_pct/100) over non-terminal stages (Phase 8).';

-- Backfill the seeded global stages with sensible pipeline probabilities.
-- Terminal-won (Closed) is 100; terminal-lost (Lost/Trash) is 0.
update public.deal_stages set probability_pct = v.pct
from (values
  ('Submitted',      10),
  ('Under Review',   20),
  ('Active',         40),
  ('Pending',        60),
  ('Under Contract', 80),
  ('Closed',        100),
  ('Lost/Trash',      0)
) as v(name, pct)
where public.deal_stages.company_id is null
  and public.deal_stages.name = v.name
  and public.deal_stages.probability_pct = 0
  and v.pct <> 0;

-- ── deals.is_draft ────────────────────────────────────────────────────────────
alter table public.deals
  add column if not exists is_draft boolean not null default false;

comment on column public.deals.is_draft is
  'Stepped-form draft: created up front so files attach across steps, flipped to false on submit. Drafts are excluded from lists/KPIs (Phase 8).';

-- The soft-delete view also hides drafts so list/KPI queries built on it are
-- correct by construction.
create or replace view public.active_deals as
  select * from public.deals where deleted_at is null and is_draft = false;

-- ── deal_comments (threaded; mirrors request_comments) ────────────────────────
create table if not exists public.deal_comments (
  id         uuid primary key default gen_random_uuid(),
  deal_id    uuid not null references public.deals (id) on delete cascade,
  user_id    uuid references public.users (id) on delete set null,
  parent_id  uuid references public.deal_comments (id) on delete cascade,  -- one level of threading
  body       text not null,
  created_at timestamptz not null default now()
);

comment on table public.deal_comments is
  'Threaded per-deal comments (mirrors request_comments; parent_id gives one reply level) — Phase 8.';

create index if not exists deal_comments_deal_id_idx on public.deal_comments (deal_id);
create index if not exists deal_comments_parent_id_idx on public.deal_comments (parent_id);

-- ── RLS for deal_comments (scoped via parent deal, like deal_activity) ────────
alter table public.deal_comments enable row level security;

drop policy if exists deal_comments_select on public.deal_comments;
create policy deal_comments_select on public.deal_comments for select to authenticated
  using (
    public.is_super_admin()
    or exists (select 1 from public.deals d where d.id = deal_comments.deal_id
               and public.is_company_member(d.company_id))
  );

drop policy if exists deal_comments_insert on public.deal_comments;
create policy deal_comments_insert on public.deal_comments for insert to authenticated
  with check (
    user_id = auth.uid()
    and (
      public.is_super_admin()
      or exists (select 1 from public.deals d where d.id = deal_comments.deal_id
                 and d.company_id = public.auth_user_company_id())
    )
  );

-- Authors edit/delete their own comments; managers (team_lead/super_admin) may
-- moderate any comment on a deal they administer.
drop policy if exists deal_comments_modify on public.deal_comments;
create policy deal_comments_modify on public.deal_comments for update to authenticated
  using (
    public.is_super_admin() or user_id = auth.uid()
    or exists (select 1 from public.deals d where d.id = deal_comments.deal_id
               and public.can_manage_company(d.company_id))
  )
  with check (
    public.is_super_admin() or user_id = auth.uid()
    or exists (select 1 from public.deals d where d.id = deal_comments.deal_id
               and public.can_manage_company(d.company_id))
  );

drop policy if exists deal_comments_delete on public.deal_comments;
create policy deal_comments_delete on public.deal_comments for delete to authenticated
  using (
    public.is_super_admin() or user_id = auth.uid()
    or exists (select 1 from public.deals d where d.id = deal_comments.deal_id
               and public.can_manage_company(d.company_id))
  );
