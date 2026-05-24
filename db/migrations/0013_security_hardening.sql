-- 0013_security_hardening.sql
-- Address Supabase security advisor warnings from the initial push:
--   * function_search_path_mutable: set_updated_at had no pinned search_path.
--   * anon_security_definer_function_executable: the auth/RLS helpers were
--     granted to anon, but anon has no RLS access and never needs them.

-- Pin search_path on the updated_at trigger function (it only touches NEW).
alter function public.set_updated_at() set search_path = '';

-- Helpers are only used by authenticated sessions and RLS; anon should not be
-- able to call them via the exposed RPC surface.
revoke execute on function
  public.auth_user_role(),
  public.auth_user_company_id(),
  public.is_super_admin(),
  public.is_company_member(uuid),
  public.is_team_lead_of(uuid, uuid),
  public.can_manage_company(uuid),
  public.is_thread_participant(uuid)
from anon;
