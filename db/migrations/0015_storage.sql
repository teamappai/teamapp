-- 0015_storage.sql
-- Storage buckets + RLS policies for file uploads (Phase 1 storage follow-up).
-- Path conventions:
--   company-logos        <company_id>/<file>
--   avatars              <user_id>/<file>
--   deal-files           <company_id>/<deal_id>/<uuid-file>      (private)
--   request-files        <company_id>/<request_id>/<uuid-file>   (private)
--   message-attachments  <company_id>/<thread_id>/<uuid-file>    (private)
--
-- (storage.foldername(name))[1] = first path segment, [2] = second segment.

insert into storage.buckets (id, name, public) values
  ('company-logos',       'company-logos',       true),
  ('avatars',             'avatars',             true),
  ('deal-files',          'deal-files',          false),
  ('request-files',       'request-files',       false),
  ('message-attachments', 'message-attachments', false)
on conflict (id) do nothing;

-- ── company-logos (public read; team_lead of the company writes) ──────────────
drop policy if exists "company_logos_read" on storage.objects;
create policy "company_logos_read" on storage.objects for select to anon, authenticated
  using (bucket_id = 'company-logos');

drop policy if exists "company_logos_write" on storage.objects;
create policy "company_logos_write" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'company-logos'
    and public.can_manage_company(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "company_logos_update" on storage.objects;
create policy "company_logos_update" on storage.objects for update to authenticated
  using (
    bucket_id = 'company-logos'
    and public.can_manage_company(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "company_logos_delete" on storage.objects;
create policy "company_logos_delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'company-logos'
    and public.can_manage_company(((storage.foldername(name))[1])::uuid)
  );

-- ── avatars (public read; a user writes only under their own uid) ─────────────
drop policy if exists "avatars_read" on storage.objects;
create policy "avatars_read" on storage.objects for select to anon, authenticated
  using (bucket_id = 'avatars');

drop policy if exists "avatars_write" on storage.objects;
create policy "avatars_write" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_update" on storage.objects;
create policy "avatars_update" on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_delete" on storage.objects;
create policy "avatars_delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── deal-files (private; same company as the deal) ────────────────────────────
drop policy if exists "deal_files_all" on storage.objects;
create policy "deal_files_all" on storage.objects for all to authenticated
  using (
    bucket_id = 'deal-files'
    and public.is_company_member(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'deal-files'
    and public.is_company_member(((storage.foldername(name))[1])::uuid)
  );

-- ── request-files (private; same company as the request) ──────────────────────
drop policy if exists "request_files_all" on storage.objects;
create policy "request_files_all" on storage.objects for all to authenticated
  using (
    bucket_id = 'request-files'
    and public.is_company_member(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'request-files'
    and public.is_company_member(((storage.foldername(name))[1])::uuid)
  );

-- ── message-attachments (private; thread participants only) ───────────────────
drop policy if exists "message_attachments_all" on storage.objects;
create policy "message_attachments_all" on storage.objects for all to authenticated
  using (
    bucket_id = 'message-attachments'
    and public.is_thread_participant(((storage.foldername(name))[2])::uuid)
  )
  with check (
    bucket_id = 'message-attachments'
    and public.is_thread_participant(((storage.foldername(name))[2])::uuid)
  );
