-- 0010_helper_functions.sql
-- Auth/role helper functions used throughout the RLS policies (0011).
--
-- NOTE ON ORDERING: the Phase 1 spec numbered RLS as 0010 and helpers as 0011,
-- but the RLS policies CALL these functions, and migrations apply in filename
-- order. Helpers must exist first, so they are 0010 and RLS is 0011.
--
-- All functions are SECURITY DEFINER so their internal reads of public.users
-- bypass RLS — this prevents infinite recursion when users' own policies need
-- to know the caller's role/company. search_path is pinned for safety.

create or replace function public.auth_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select u.role from public.users u where u.id = auth.uid();
$$;

create or replace function public.auth_user_company_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select u.company_id from public.users u where u.id = auth.uid();
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'super_admin'
  );
$$;

-- True if the caller is a super_admin OR a member of target_company_id.
create or replace function public.is_company_member(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid()
      and (u.role = 'super_admin' or u.company_id = target_company_id)
  );
$$;

-- True if user `uid` is a team_lead of target_company_id (audit: helper named in spec).
create or replace function public.is_team_lead_of(uid uuid, target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.users u
    where u.id = uid
      and u.role = 'team_lead'
      and u.company_id = target_company_id
  );
$$;

-- True if the caller may administer target_company_id (super_admin or its team_lead).
create or replace function public.can_manage_company(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_super_admin()
      or public.is_team_lead_of(auth.uid(), target_company_id);
$$;

grant execute on function
  public.auth_user_role(),
  public.auth_user_company_id(),
  public.is_super_admin(),
  public.is_company_member(uuid),
  public.is_team_lead_of(uuid, uuid),
  public.can_manage_company(uuid)
to authenticated, anon;
