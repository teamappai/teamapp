-- 0016_brokerage_info.sql
-- Brokerage affiliation for companies. Real-estate teams operate under a
-- brokerage (e.g. "Real Brokerage", "Compass"); later phases surface this for
-- compliance display, business cards, and CMA documents. Modeled per-company.

alter table public.companies
  add column if not exists brokerage_name text;

alter table public.companies
  add column if not exists brokerage_license_number text;

alter table public.companies
  add column if not exists brokerage_state text;

-- 2-letter state code when present.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'companies_brokerage_state_len_ck'
      and conrelid = 'public.companies'::regclass
  ) then
    alter table public.companies
      add constraint companies_brokerage_state_len_ck
      check (brokerage_state is null or length(brokerage_state) = 2);
  end if;
end $$;

comment on column public.companies.brokerage_name is
  'Brokerage the team operates under (e.g. "Real Brokerage"). Compliance/CMA display.';
comment on column public.companies.brokerage_license_number is
  'Brokerage license number. For documents (business cards, CMA), not profile display.';
comment on column public.companies.brokerage_state is
  '2-letter state code for the brokerage license jurisdiction.';
