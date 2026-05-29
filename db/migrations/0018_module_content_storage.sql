-- 0018_module_content_storage.sql
-- Storage bucket for training module content (images, file attachments) embedded
-- in the block-based module editor (Phase 6 — Management Hub).
-- Path convention:
--   module-content  <company_id>/<section_id>/<module_id>/<uuid-file>
--
-- Reads: any authenticated user — published module content is consumed by agents.
-- Writes: team_lead of the company or super_admin, path-scoped by company_id
--         (first path segment). Mirrors the company-logos write pattern (0015).

insert into storage.buckets (id, name, public) values
  ('module-content', 'module-content', false)
on conflict (id) do nothing;

-- ── reads: any authenticated user ─────────────────────────────────────────────
drop policy if exists "module_content_read" on storage.objects;
create policy "module_content_read" on storage.objects for select to authenticated
  using (bucket_id = 'module-content');

-- ── writes: company manager (team_lead/super_admin), scoped by company_id ─────
drop policy if exists "module_content_write" on storage.objects;
create policy "module_content_write" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'module-content'
    and public.can_manage_company(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "module_content_update" on storage.objects;
create policy "module_content_update" on storage.objects for update to authenticated
  using (
    bucket_id = 'module-content'
    and public.can_manage_company(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "module_content_delete" on storage.objects;
create policy "module_content_delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'module-content'
    and public.can_manage_company(((storage.foldername(name))[1])::uuid)
  );
