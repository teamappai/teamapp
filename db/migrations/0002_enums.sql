-- 0002_enums.sql
-- Closed-set enum types. Each wrapped so re-running the migration is a no-op.

-- The canonical five roles. NEVER expose "Company Admin" as a separate role
-- (audit F-038); team_lead IS the company owner.
do $$ begin
  create type public.user_role as enum (
    'super_admin', 'team_lead', 'agent', 'admin_tc', 'marketing'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.company_plan as enum ('launch', 'pro', 'brokerage');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.company_status as enum (
    'trialing', 'active', 'past_due', 'canceled', 'paused'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.user_status as enum ('invited', 'active', 'archived');
exception when duplicate_object then null; end $$;

-- Shared publish lifecycle for training sections and modules (audit F-045).
do $$ begin
  create type public.publish_status as enum ('draft', 'published', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.progress_status as enum (
    'not_started', 'in_progress', 'completed'
  );
exception when duplicate_object then null; end $$;

-- Which side of the transaction a deal represents (audit F-081). Drives which
-- agent/broker fields are relevant in the UI.
do $$ begin
  create type public.deal_representing as enum ('buyer', 'seller', 'dual');
exception when duplicate_object then null; end $$;

-- Requests workflow pipeline (audit PA-4 / F-127).
do $$ begin
  create type public.request_status as enum (
    'pending', 'in_progress', 'ready_for_review', 'completed', 'rejected'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.request_priority as enum (
    'low', 'normal', 'high', 'urgent'
  );
exception when duplicate_object then null; end $$;

-- Goals (audit PA-6).
do $$ begin
  create type public.goal_period as enum ('monthly', 'quarterly', 'annual');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.goal_type as enum (
    'gci_cents', 'closed_volume_cents', 'closed_deals_count',
    'appointments_count', 'conversations_count'
  );
exception when duplicate_object then null; end $$;

-- Messaging (audit F-091).
do $$ begin
  create type public.message_thread_type as enum (
    'direct', 'group', 'channel'
  );
exception when duplicate_object then null; end $$;

-- Per-deal audit trail event kinds.
do $$ begin
  create type public.deal_activity_event as enum (
    'created', 'stage_changed', 'field_updated', 'file_uploaded',
    'ai_extracted', 'comment_added'
  );
exception when duplicate_object then null; end $$;
