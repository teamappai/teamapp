-- 0011_rls.sql
-- Enable Row Level Security on every table and define policies for the five
-- roles. Helper functions live in 0010. service_role bypasses RLS (used by the
-- seed script and trusted server jobs).
--
-- Policy model:
--   super_admin           -> full read/write everywhere (platform staff, no company)
--   team_lead             -> manage everything in their company (can_manage_company)
--   agent/admin_tc/mktg   -> read company rows; write own/assigned rows
--
-- Cross-table checks use EXISTS against parent tables (child -> parent only, so
-- no policy recursion). Same-table participant checks use a SECURITY DEFINER
-- helper to avoid infinite recursion.

-- Extra helper: thread participation (avoids self-referential RLS recursion).
create or replace function public.is_thread_participant(tid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.message_thread_participants p
    where p.thread_id = tid and p.user_id = auth.uid()
  );
$$;
grant execute on function public.is_thread_participant(uuid) to authenticated, anon;

-- Make soft-delete views honor the querying user's RLS (PG15+). Without this,
-- views run as their owner and bypass RLS entirely.
alter view public.active_companies          set (security_invoker = true);
alter view public.active_users              set (security_invoker = true);
alter view public.active_training_sections  set (security_invoker = true);
alter view public.active_training_modules   set (security_invoker = true);
alter view public.active_deals              set (security_invoker = true);
alter view public.active_requests           set (security_invoker = true);

-- ════════════════════════════════════════════════════════════════════════════
-- companies
-- ════════════════════════════════════════════════════════════════════════════
alter table public.companies enable row level security;

drop policy if exists companies_select on public.companies;
create policy companies_select on public.companies for select to authenticated
  using (public.is_super_admin() or id = public.auth_user_company_id());

drop policy if exists companies_insert on public.companies;
create policy companies_insert on public.companies for insert to authenticated
  with check (public.is_super_admin());

drop policy if exists companies_update on public.companies;
create policy companies_update on public.companies for update to authenticated
  using (public.can_manage_company(id))
  with check (public.can_manage_company(id));

drop policy if exists companies_delete on public.companies;
create policy companies_delete on public.companies for delete to authenticated
  using (public.is_super_admin());

-- ════════════════════════════════════════════════════════════════════════════
-- users
-- ════════════════════════════════════════════════════════════════════════════
alter table public.users enable row level security;

drop policy if exists users_select on public.users;
create policy users_select on public.users for select to authenticated
  using (
    public.is_super_admin()
    or id = auth.uid()
    or company_id = public.auth_user_company_id()
  );

drop policy if exists users_insert on public.users;
create policy users_insert on public.users for insert to authenticated
  with check (public.is_super_admin() or public.can_manage_company(company_id));

drop policy if exists users_update on public.users;
create policy users_update on public.users for update to authenticated
  using (
    public.is_super_admin() or id = auth.uid() or public.can_manage_company(company_id)
  )
  with check (
    public.is_super_admin() or id = auth.uid() or public.can_manage_company(company_id)
  );

drop policy if exists users_delete on public.users;
create policy users_delete on public.users for delete to authenticated
  using (public.is_super_admin() or public.can_manage_company(company_id));

-- ════════════════════════════════════════════════════════════════════════════
-- user_invitations  (admin-managed)
-- ════════════════════════════════════════════════════════════════════════════
alter table public.user_invitations enable row level security;

drop policy if exists user_invitations_select on public.user_invitations;
create policy user_invitations_select on public.user_invitations for select to authenticated
  using (public.can_manage_company(company_id));

drop policy if exists user_invitations_write on public.user_invitations;
create policy user_invitations_write on public.user_invitations for all to authenticated
  using (public.can_manage_company(company_id))
  with check (public.can_manage_company(company_id));

-- ════════════════════════════════════════════════════════════════════════════
-- training_sections  (PA-1 role visibility; NULL company_id = global)
-- ════════════════════════════════════════════════════════════════════════════
alter table public.training_sections enable row level security;

drop policy if exists training_sections_select on public.training_sections;
create policy training_sections_select on public.training_sections for select to authenticated
  using (
    public.is_super_admin()
    or public.can_manage_company(company_id)
    or (
      (company_id is null or company_id = public.auth_user_company_id())
      and status = 'published'
      and (
        cardinality(visible_to_roles) = 0
        or public.auth_user_role() = any (visible_to_roles)
      )
    )
  );

drop policy if exists training_sections_write on public.training_sections;
create policy training_sections_write on public.training_sections for all to authenticated
  using (public.is_super_admin() or public.can_manage_company(company_id))
  with check (public.is_super_admin() or public.can_manage_company(company_id));

-- ════════════════════════════════════════════════════════════════════════════
-- training_modules  (visibility derived from parent section)
-- ════════════════════════════════════════════════════════════════════════════
alter table public.training_modules enable row level security;

drop policy if exists training_modules_select on public.training_modules;
create policy training_modules_select on public.training_modules for select to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.training_sections s
      where s.id = training_modules.section_id
        and (
          public.can_manage_company(s.company_id)
          or (
            training_modules.status = 'published'
            and (
              cardinality(training_modules.visible_to_roles) = 0
              or public.auth_user_role() = any (training_modules.visible_to_roles)
            )
          )
        )
    )
  );

drop policy if exists training_modules_write on public.training_modules;
create policy training_modules_write on public.training_modules for all to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.training_sections s
      where s.id = training_modules.section_id
        and public.can_manage_company(s.company_id)
    )
  )
  with check (
    public.is_super_admin()
    or exists (
      select 1 from public.training_sections s
      where s.id = training_modules.section_id
        and public.can_manage_company(s.company_id)
    )
  );

-- ════════════════════════════════════════════════════════════════════════════
-- training_progress  (own row; managers/peers in company can read)
-- ════════════════════════════════════════════════════════════════════════════
alter table public.training_progress enable row level security;

drop policy if exists training_progress_select on public.training_progress;
create policy training_progress_select on public.training_progress for select to authenticated
  using (
    public.is_super_admin()
    or user_id = auth.uid()
    or exists (
      select 1 from public.users tu
      where tu.id = training_progress.user_id
        and tu.company_id = public.auth_user_company_id()
    )
  );

drop policy if exists training_progress_write on public.training_progress;
create policy training_progress_write on public.training_progress for all to authenticated
  using (
    public.is_super_admin()
    or user_id = auth.uid()
    or exists (
      select 1 from public.users tu
      where tu.id = training_progress.user_id
        and public.can_manage_company(tu.company_id)
    )
  )
  with check (
    public.is_super_admin()
    or user_id = auth.uid()
    or exists (
      select 1 from public.users tu
      where tu.id = training_progress.user_id
        and public.can_manage_company(tu.company_id)
    )
  );

-- ════════════════════════════════════════════════════════════════════════════
-- config tables: deal_types, deal_stages, request_types
--   read: global rows + own company rows; write: super_admin (global) or team_lead
-- ════════════════════════════════════════════════════════════════════════════
alter table public.deal_types enable row level security;
drop policy if exists deal_types_select on public.deal_types;
create policy deal_types_select on public.deal_types for select to authenticated
  using (public.is_super_admin() or company_id is null or company_id = public.auth_user_company_id());
drop policy if exists deal_types_write on public.deal_types;
create policy deal_types_write on public.deal_types for all to authenticated
  using (public.is_super_admin() or public.can_manage_company(company_id))
  with check (public.is_super_admin() or public.can_manage_company(company_id));

alter table public.deal_stages enable row level security;
drop policy if exists deal_stages_select on public.deal_stages;
create policy deal_stages_select on public.deal_stages for select to authenticated
  using (public.is_super_admin() or company_id is null or company_id = public.auth_user_company_id());
drop policy if exists deal_stages_write on public.deal_stages;
create policy deal_stages_write on public.deal_stages for all to authenticated
  using (public.is_super_admin() or public.can_manage_company(company_id))
  with check (public.is_super_admin() or public.can_manage_company(company_id));

alter table public.request_types enable row level security;
drop policy if exists request_types_select on public.request_types;
create policy request_types_select on public.request_types for select to authenticated
  using (public.is_super_admin() or company_id is null or company_id = public.auth_user_company_id());
drop policy if exists request_types_write on public.request_types;
create policy request_types_write on public.request_types for all to authenticated
  using (public.is_super_admin() or public.can_manage_company(company_id))
  with check (public.is_super_admin() or public.can_manage_company(company_id));

-- ════════════════════════════════════════════════════════════════════════════
-- deals  (company-wide read; agents write own/assigned; team_lead writes all)
-- ════════════════════════════════════════════════════════════════════════════
alter table public.deals enable row level security;

drop policy if exists deals_select on public.deals;
create policy deals_select on public.deals for select to authenticated
  using (public.is_company_member(company_id));

drop policy if exists deals_insert on public.deals;
create policy deals_insert on public.deals for insert to authenticated
  with check (
    public.is_super_admin()
    or public.can_manage_company(company_id)
    or (company_id = public.auth_user_company_id() and created_by = auth.uid())
  );

drop policy if exists deals_update on public.deals;
create policy deals_update on public.deals for update to authenticated
  using (
    public.is_super_admin()
    or public.can_manage_company(company_id)
    or (
      company_id = public.auth_user_company_id()
      and (
        created_by = auth.uid()
        or listing_agent_id = auth.uid()
        or co_listing_agent_id = auth.uid()
        or buyer_agent_id = auth.uid()
      )
    )
  )
  with check (
    public.is_super_admin()
    or public.can_manage_company(company_id)
    or (
      company_id = public.auth_user_company_id()
      and (
        created_by = auth.uid()
        or listing_agent_id = auth.uid()
        or co_listing_agent_id = auth.uid()
        or buyer_agent_id = auth.uid()
      )
    )
  );

drop policy if exists deals_delete on public.deals;
create policy deals_delete on public.deals for delete to authenticated
  using (
    public.is_super_admin()
    or public.can_manage_company(company_id)
    or created_by = auth.uid()
  );

-- ════════════════════════════════════════════════════════════════════════════
-- deal_files / deal_ai_extractions / deal_activity  (scoped via parent deal)
-- ════════════════════════════════════════════════════════════════════════════
alter table public.deal_files enable row level security;

drop policy if exists deal_files_select on public.deal_files;
create policy deal_files_select on public.deal_files for select to authenticated
  using (
    public.is_super_admin()
    or exists (select 1 from public.deals d where d.id = deal_files.deal_id
               and public.is_company_member(d.company_id))
  );

drop policy if exists deal_files_insert on public.deal_files;
create policy deal_files_insert on public.deal_files for insert to authenticated
  with check (
    exists (select 1 from public.deals d where d.id = deal_files.deal_id
            and d.company_id = public.auth_user_company_id())
    or public.is_super_admin()
  );

drop policy if exists deal_files_modify on public.deal_files;
create policy deal_files_modify on public.deal_files for update to authenticated
  using (
    public.is_super_admin() or uploaded_by = auth.uid()
    or exists (select 1 from public.deals d where d.id = deal_files.deal_id
               and public.can_manage_company(d.company_id))
  )
  with check (
    public.is_super_admin() or uploaded_by = auth.uid()
    or exists (select 1 from public.deals d where d.id = deal_files.deal_id
               and public.can_manage_company(d.company_id))
  );

drop policy if exists deal_files_delete on public.deal_files;
create policy deal_files_delete on public.deal_files for delete to authenticated
  using (
    public.is_super_admin() or uploaded_by = auth.uid()
    or exists (select 1 from public.deals d where d.id = deal_files.deal_id
               and public.can_manage_company(d.company_id))
  );

alter table public.deal_ai_extractions enable row level security;

drop policy if exists deal_ai_extractions_select on public.deal_ai_extractions;
create policy deal_ai_extractions_select on public.deal_ai_extractions for select to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.deal_files f
      join public.deals d on d.id = f.deal_id
      where f.id = deal_ai_extractions.deal_file_id
        and public.is_company_member(d.company_id)
    )
  );

drop policy if exists deal_ai_extractions_write on public.deal_ai_extractions;
create policy deal_ai_extractions_write on public.deal_ai_extractions for all to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.deal_files f
      join public.deals d on d.id = f.deal_id
      where f.id = deal_ai_extractions.deal_file_id
        and d.company_id = public.auth_user_company_id()
    )
  )
  with check (
    public.is_super_admin()
    or exists (
      select 1 from public.deal_files f
      join public.deals d on d.id = f.deal_id
      where f.id = deal_ai_extractions.deal_file_id
        and d.company_id = public.auth_user_company_id()
    )
  );

alter table public.deal_activity enable row level security;

drop policy if exists deal_activity_select on public.deal_activity;
create policy deal_activity_select on public.deal_activity for select to authenticated
  using (
    public.is_super_admin()
    or exists (select 1 from public.deals d where d.id = deal_activity.deal_id
               and public.is_company_member(d.company_id))
  );

drop policy if exists deal_activity_insert on public.deal_activity;
create policy deal_activity_insert on public.deal_activity for insert to authenticated
  with check (
    public.is_super_admin()
    or exists (select 1 from public.deals d where d.id = deal_activity.deal_id
               and d.company_id = public.auth_user_company_id())
  );

drop policy if exists deal_activity_delete on public.deal_activity;
create policy deal_activity_delete on public.deal_activity for delete to authenticated
  using (public.is_super_admin());

-- ════════════════════════════════════════════════════════════════════════════
-- requests  (company read; creator/assignee/role-queue + managers write)
-- ════════════════════════════════════════════════════════════════════════════
alter table public.requests enable row level security;

drop policy if exists requests_select on public.requests;
create policy requests_select on public.requests for select to authenticated
  using (public.is_company_member(company_id));

drop policy if exists requests_insert on public.requests;
create policy requests_insert on public.requests for insert to authenticated
  with check (
    public.is_super_admin()
    or (company_id = public.auth_user_company_id()
        and (created_by = auth.uid() or public.can_manage_company(company_id)))
  );

drop policy if exists requests_update on public.requests;
create policy requests_update on public.requests for update to authenticated
  using (
    public.is_super_admin()
    or public.can_manage_company(company_id)
    or created_by = auth.uid()
    or assigned_to_user_id = auth.uid()
    or (company_id = public.auth_user_company_id() and assigned_to_role = public.auth_user_role())
  )
  with check (
    public.is_super_admin()
    or public.can_manage_company(company_id)
    or created_by = auth.uid()
    or assigned_to_user_id = auth.uid()
    or (company_id = public.auth_user_company_id() and assigned_to_role = public.auth_user_role())
  );

drop policy if exists requests_delete on public.requests;
create policy requests_delete on public.requests for delete to authenticated
  using (
    public.is_super_admin() or public.can_manage_company(company_id) or created_by = auth.uid()
  );

-- ════════════════════════════════════════════════════════════════════════════
-- request_comments  (internal vs shared visibility; audit F-129)
-- ════════════════════════════════════════════════════════════════════════════
alter table public.request_comments enable row level security;

drop policy if exists request_comments_select on public.request_comments;
create policy request_comments_select on public.request_comments for select to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.requests r
      where r.id = request_comments.request_id
        and public.is_company_member(r.company_id)
        and (
          request_comments.is_internal = false
          or public.can_manage_company(r.company_id)
          or r.assigned_to_user_id = auth.uid()
          or r.assigned_to_role = public.auth_user_role()
        )
    )
  );

drop policy if exists request_comments_insert on public.request_comments;
create policy request_comments_insert on public.request_comments for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.requests r where r.id = request_comments.request_id
                and public.is_company_member(r.company_id))
  );

drop policy if exists request_comments_modify on public.request_comments;
create policy request_comments_modify on public.request_comments for update to authenticated
  using (public.is_super_admin() or user_id = auth.uid())
  with check (public.is_super_admin() or user_id = auth.uid());

drop policy if exists request_comments_delete on public.request_comments;
create policy request_comments_delete on public.request_comments for delete to authenticated
  using (
    public.is_super_admin() or user_id = auth.uid()
    or exists (select 1 from public.requests r where r.id = request_comments.request_id
               and public.can_manage_company(r.company_id))
  );

-- ════════════════════════════════════════════════════════════════════════════
-- request_files  (scoped via parent request)
-- ════════════════════════════════════════════════════════════════════════════
alter table public.request_files enable row level security;

drop policy if exists request_files_select on public.request_files;
create policy request_files_select on public.request_files for select to authenticated
  using (
    public.is_super_admin()
    or exists (select 1 from public.requests r where r.id = request_files.request_id
               and public.is_company_member(r.company_id))
  );

drop policy if exists request_files_insert on public.request_files;
create policy request_files_insert on public.request_files for insert to authenticated
  with check (
    public.is_super_admin()
    or exists (select 1 from public.requests r where r.id = request_files.request_id
               and r.company_id = public.auth_user_company_id())
  );

drop policy if exists request_files_delete on public.request_files;
create policy request_files_delete on public.request_files for delete to authenticated
  using (
    public.is_super_admin() or uploaded_by = auth.uid()
    or exists (select 1 from public.requests r where r.id = request_files.request_id
               and public.can_manage_company(r.company_id))
  );

-- ════════════════════════════════════════════════════════════════════════════
-- activity_logs  (company read; own write; managers manage)
-- ════════════════════════════════════════════════════════════════════════════
alter table public.activity_logs enable row level security;

drop policy if exists activity_logs_select on public.activity_logs;
create policy activity_logs_select on public.activity_logs for select to authenticated
  using (public.is_super_admin() or company_id = public.auth_user_company_id());

drop policy if exists activity_logs_write on public.activity_logs;
create policy activity_logs_write on public.activity_logs for all to authenticated
  using (
    public.is_super_admin() or user_id = auth.uid() or public.can_manage_company(company_id)
  )
  with check (
    (company_id = public.auth_user_company_id()
     and (user_id = auth.uid() or public.can_manage_company(company_id)))
    or public.is_super_admin()
  );

-- ════════════════════════════════════════════════════════════════════════════
-- goals  (company read; own + managers write)
-- ════════════════════════════════════════════════════════════════════════════
alter table public.goals enable row level security;

drop policy if exists goals_select on public.goals;
create policy goals_select on public.goals for select to authenticated
  using (public.is_super_admin() or company_id = public.auth_user_company_id());

drop policy if exists goals_write on public.goals;
create policy goals_write on public.goals for all to authenticated
  using (
    public.is_super_admin() or public.can_manage_company(company_id) or user_id = auth.uid()
  )
  with check (
    (company_id = public.auth_user_company_id()
     and (user_id = auth.uid() or public.can_manage_company(company_id)))
    or public.is_super_admin()
  );

-- ════════════════════════════════════════════════════════════════════════════
-- coaching_log_entries  (private: agent, coach, managers, super_admin)
-- ════════════════════════════════════════════════════════════════════════════
alter table public.coaching_log_entries enable row level security;

drop policy if exists coaching_log_entries_select on public.coaching_log_entries;
create policy coaching_log_entries_select on public.coaching_log_entries for select to authenticated
  using (
    public.is_super_admin()
    or agent_user_id = auth.uid()
    or coach_user_id = auth.uid()
    or exists (select 1 from public.users au where au.id = coaching_log_entries.agent_user_id
               and public.can_manage_company(au.company_id))
  );

drop policy if exists coaching_log_entries_write on public.coaching_log_entries;
create policy coaching_log_entries_write on public.coaching_log_entries for all to authenticated
  using (
    public.is_super_admin()
    or exists (select 1 from public.users au where au.id = coaching_log_entries.agent_user_id
               and public.can_manage_company(au.company_id))
  )
  with check (
    public.is_super_admin()
    or exists (select 1 from public.users au where au.id = coaching_log_entries.agent_user_id
               and public.can_manage_company(au.company_id))
  );

-- ════════════════════════════════════════════════════════════════════════════
-- messaging: threads, participants, messages, reactions  (participant-scoped)
-- ════════════════════════════════════════════════════════════════════════════
alter table public.message_threads enable row level security;

drop policy if exists message_threads_select on public.message_threads;
create policy message_threads_select on public.message_threads for select to authenticated
  using (public.is_super_admin() or public.is_thread_participant(id));

drop policy if exists message_threads_insert on public.message_threads;
create policy message_threads_insert on public.message_threads for insert to authenticated
  with check (
    public.is_super_admin()
    or (company_id = public.auth_user_company_id() and created_by = auth.uid())
  );

drop policy if exists message_threads_modify on public.message_threads;
create policy message_threads_modify on public.message_threads for update to authenticated
  using (public.is_super_admin() or created_by = auth.uid())
  with check (public.is_super_admin() or created_by = auth.uid());

drop policy if exists message_threads_delete on public.message_threads;
create policy message_threads_delete on public.message_threads for delete to authenticated
  using (public.is_super_admin() or created_by = auth.uid());

alter table public.message_thread_participants enable row level security;

drop policy if exists message_thread_participants_select on public.message_thread_participants;
create policy message_thread_participants_select on public.message_thread_participants for select to authenticated
  using (
    public.is_super_admin()
    or user_id = auth.uid()
    or public.is_thread_participant(thread_id)
  );

drop policy if exists message_thread_participants_insert on public.message_thread_participants;
create policy message_thread_participants_insert on public.message_thread_participants for insert to authenticated
  with check (
    public.is_super_admin()
    or exists (select 1 from public.message_threads t where t.id = message_thread_participants.thread_id
               and t.created_by = auth.uid())
  );

drop policy if exists message_thread_participants_modify on public.message_thread_participants;
create policy message_thread_participants_modify on public.message_thread_participants for update to authenticated
  using (public.is_super_admin() or user_id = auth.uid())
  with check (public.is_super_admin() or user_id = auth.uid());

drop policy if exists message_thread_participants_delete on public.message_thread_participants;
create policy message_thread_participants_delete on public.message_thread_participants for delete to authenticated
  using (
    public.is_super_admin()
    or user_id = auth.uid()
    or exists (select 1 from public.message_threads t where t.id = message_thread_participants.thread_id
               and t.created_by = auth.uid())
  );

alter table public.messages enable row level security;

drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages for select to authenticated
  using (public.is_super_admin() or public.is_thread_participant(thread_id));

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_thread_participant(thread_id));

drop policy if exists messages_modify on public.messages;
create policy messages_modify on public.messages for update to authenticated
  using (public.is_super_admin() or sender_id = auth.uid())
  with check (public.is_super_admin() or sender_id = auth.uid());

drop policy if exists messages_delete on public.messages;
create policy messages_delete on public.messages for delete to authenticated
  using (public.is_super_admin() or sender_id = auth.uid());

alter table public.message_reactions enable row level security;

drop policy if exists message_reactions_select on public.message_reactions;
create policy message_reactions_select on public.message_reactions for select to authenticated
  using (
    public.is_super_admin()
    or exists (select 1 from public.messages m where m.id = message_reactions.message_id
               and public.is_thread_participant(m.thread_id))
  );

drop policy if exists message_reactions_insert on public.message_reactions;
create policy message_reactions_insert on public.message_reactions for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.messages m where m.id = message_reactions.message_id
                and public.is_thread_participant(m.thread_id))
  );

drop policy if exists message_reactions_delete on public.message_reactions;
create policy message_reactions_delete on public.message_reactions for delete to authenticated
  using (public.is_super_admin() or user_id = auth.uid());

-- ════════════════════════════════════════════════════════════════════════════
-- meta: audit_log, feature_flags, subscription_events
-- ════════════════════════════════════════════════════════════════════════════
alter table public.audit_log enable row level security;

drop policy if exists audit_log_select on public.audit_log;
create policy audit_log_select on public.audit_log for select to authenticated
  using (public.is_super_admin());

drop policy if exists audit_log_insert on public.audit_log;
create policy audit_log_insert on public.audit_log for insert to authenticated
  with check (public.is_super_admin() or actor_user_id = auth.uid());

alter table public.feature_flags enable row level security;

drop policy if exists feature_flags_select on public.feature_flags;
create policy feature_flags_select on public.feature_flags for select to authenticated
  using (true);

drop policy if exists feature_flags_write on public.feature_flags;
create policy feature_flags_write on public.feature_flags for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

alter table public.subscription_events enable row level security;

drop policy if exists subscription_events_select on public.subscription_events;
create policy subscription_events_select on public.subscription_events for select to authenticated
  using (public.is_super_admin() or public.can_manage_company(company_id));

drop policy if exists subscription_events_write on public.subscription_events;
create policy subscription_events_write on public.subscription_events for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());
