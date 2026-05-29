-- 0019_invitation_full_name.sql
-- The invite modal (single + CSV bulk) collects a full name up front, but the
-- Phase 1 user_invitations table only stored email/role. Persist the name so the
-- Users page can show pending invitees by name and the signup form can prefill it.

alter table public.user_invitations
  add column if not exists full_name text;

comment on column public.user_invitations.full_name is
  'Invitee name captured at invite time (single + CSV bulk). Prefilled into signup; the canonical name is set on public.users at accept time.';
