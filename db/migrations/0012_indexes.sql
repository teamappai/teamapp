-- 0012_indexes.sql
-- Performance indexes. Postgres does NOT auto-index foreign keys, and the RLS
-- policies in 0011 lean on EXISTS joins across parent/child tables, so the FK
-- indexes below matter for both query and policy-evaluation speed.

-- ── Explicitly requested by the Phase 1 spec ─────────────────────────────────
create index if not exists idx_users_company_role
  on public.users (company_id, role);

create index if not exists idx_deals_company_stage_created
  on public.deals (company_id, stage_id, created_at desc);

create index if not exists idx_deals_company_active
  on public.deals (company_id)
  where deleted_at is null;

create index if not exists idx_requests_company_status_due
  on public.requests (company_id, status, due_date);

create index if not exists idx_activity_logs_user_date
  on public.activity_logs (user_id, log_date desc);

create index if not exists idx_messages_thread_created
  on public.messages (thread_id, created_at desc);

-- training_progress(user_id, module_id) is already covered by the UNIQUE
-- constraint's implicit index, so no separate index is created here.

-- ── FK / RLS-supporting indexes (defense for policy EXISTS joins) ────────────
create index if not exists idx_users_company_id
  on public.users (company_id);

create index if not exists idx_training_sections_company_id
  on public.training_sections (company_id);

create index if not exists idx_training_modules_section_id
  on public.training_modules (section_id);

create index if not exists idx_training_progress_module_id
  on public.training_progress (module_id);

create index if not exists idx_deal_files_deal_id
  on public.deal_files (deal_id);

create index if not exists idx_deal_ai_extractions_deal_file_id
  on public.deal_ai_extractions (deal_file_id);

create index if not exists idx_deal_activity_deal_id
  on public.deal_activity (deal_id);

create index if not exists idx_requests_type_id
  on public.requests (request_type_id);

create index if not exists idx_requests_assigned_user
  on public.requests (assigned_to_user_id);

create index if not exists idx_request_comments_request_id
  on public.request_comments (request_id);

create index if not exists idx_request_files_request_id
  on public.request_files (request_id);

create index if not exists idx_goals_company_id
  on public.goals (company_id);

create index if not exists idx_coaching_log_agent
  on public.coaching_log_entries (agent_user_id);

create index if not exists idx_thread_participants_user
  on public.message_thread_participants (user_id);

create index if not exists idx_message_reactions_message_id
  on public.message_reactions (message_id);

create index if not exists idx_subscription_events_company_id
  on public.subscription_events (company_id);
