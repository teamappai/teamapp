-- 0014_revoke_public_execute.sql
-- Postgres grants EXECUTE to PUBLIC by default, so 0013's "revoke from anon"
-- did not actually remove anon's access (anon inherits via PUBLIC). Revoke from
-- PUBLIC and re-grant only to authenticated.
--
-- NOTE: `authenticated` MUST retain EXECUTE — RLS policies call these helpers
-- as the querying role, so revoking it would break RLS. The residual
-- "authenticated_security_definer_function_executable" advisor warning is an
-- accepted tradeoff of keeping RLS helpers in the public schema. To silence it
-- entirely, move these helpers into a non-API-exposed schema (e.g. `private`)
-- in a future migration.

revoke execute on function
  public.auth_user_role(),
  public.auth_user_company_id(),
  public.is_super_admin(),
  public.is_company_member(uuid),
  public.is_team_lead_of(uuid, uuid),
  public.can_manage_company(uuid),
  public.is_thread_participant(uuid)
from public, anon;

grant execute on function
  public.auth_user_role(),
  public.auth_user_company_id(),
  public.is_super_admin(),
  public.is_company_member(uuid),
  public.is_team_lead_of(uuid, uuid),
  public.can_manage_company(uuid),
  public.is_thread_participant(uuid)
to authenticated;
