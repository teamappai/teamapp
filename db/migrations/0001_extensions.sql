-- 0001_extensions.sql
-- Extensions and shared trigger helpers used by every later migration.
-- Idempotent.

-- gen_random_uuid() is in core on PG13+, but pgcrypto is harmless and keeps
-- us portable if the helper is ever needed elsewhere.
create extension if not exists pgcrypto;

-- Generic updated_at maintenance trigger. Attached to every table that has an
-- updated_at column (see table migrations).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'BEFORE UPDATE trigger function: stamps updated_at = now() on every row update.';
