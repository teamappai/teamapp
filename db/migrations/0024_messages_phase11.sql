-- 0024_messages_phase11.sql
-- Phase 11 (Messages — team chat). Builds on the Phase 1 messaging schema
-- (message_threads / message_thread_participants / messages / message_reactions
-- in 0008, RLS in 0011, the private message-attachments bucket in 0015). Three
-- concerns:
--   1. Nudge integration (Decision 9): coaching/training "nudges" now post a real
--      chat message into a DM thread instead of only writing a notifications row.
--      Messages carry an origin tag so the UI can badge nudge messages.
--   2. Supabase Realtime: add the chat tables to the supabase_realtime
--      publication and set REPLICA IDENTITY FULL so INSERT/DELETE payloads carry
--      enough columns for the client to reconcile (reactions key on the old row).
--   3. The message-attachments storage bucket already exists (0015) with
--      participant-scoped RLS — nothing to add here, noted for completeness.

-- ════════════════════════════════════════════════════════════════════════════
-- 1. Message origin tag (nudge integration — Decision 9)
-- ════════════════════════════════════════════════════════════════════════════
alter table public.messages
  add column if not exists context_type text not null default 'normal';

do $$ begin
  alter table public.messages
    add constraint messages_context_type_ck
    check (context_type in ('normal', 'coaching_nudge', 'training_nudge'));
exception when duplicate_object then null; end $$;

alter table public.messages
  add column if not exists context_payload jsonb;

comment on column public.messages.context_type is
  'Origin of the message: normal chat, or a coaching/training nudge surfaced as chat (Decision 9).';
comment on column public.messages.context_payload is
  'Nudge-specific metadata (reason, section_id, days_inactive, …) for context_type <> normal.';

-- ════════════════════════════════════════════════════════════════════════════
-- 2. Realtime: publish the chat tables + full replica identity
-- ════════════════════════════════════════════════════════════════════════════
-- Supabase hosts a pre-created `supabase_realtime` publication. Adding a table
-- that is already a member raises duplicate_object — swallow it so the migration
-- is idempotent.
do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.message_reactions;
exception when duplicate_object then null; end $$;

-- REPLICA IDENTITY FULL so DELETE events on message_reactions include the full
-- old row (message_id/user_id/emoji) — the client needs them to remove the right
-- reaction chip in real time. messages gets it too for edit/delete reconciliation.
alter table public.messages replica identity full;
alter table public.message_reactions replica identity full;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. message-attachments bucket: already created with participant-scoped RLS in
--    migration 0015 (path <company_id>/<thread_id>/<uuid-file>). No change.
-- ════════════════════════════════════════════════════════════════════════════
