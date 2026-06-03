-- 0029_flags_seed.sql
-- Phase 15 (PostHog instrumentation + feature flags). Additive only.
--
-- The hybrid flag resolver (lib/flags) checks this DB table FIRST, then falls
-- through to PostHog. The base feature_flags table (0009_meta.sql) already has
-- `enabled_globally` (on for everyone) and `enabled_company_ids` (per-company
-- allowlist). This migration adds one more lever and seeds the launch flag set:
--
--   • `enabled` (nullable boolean) — an explicit per-flag OVERRIDE that wins over
--     PostHog in BOTH directions:
--       NULL  → no opinion; resolver defers to enabled_globally / company list / PostHog
--       TRUE  → force ON  (kill switch held open)
--       FALSE → force OFF (kill switch flipped — true off, regardless of PostHog)
--     This makes the ON-by-default kill switches (playbook library, session
--     replay) deterministic without depending on PostHog being reachable.

-- ── enabled override column ───────────────────────────────────────────────────
alter table public.feature_flags
  add column if not exists enabled boolean;

comment on column public.feature_flags.enabled is
  'Explicit override for the hybrid resolver: NULL defers (to enabled_globally / company allowlist / PostHog), TRUE forces on, FALSE forces off (kill switch). See lib/flags.';

-- ── launch flag set (Phase 15 §G3) ────────────────────────────────────────────
-- Idempotent seed. enabled_globally encodes the default state; enabled stays
-- NULL so PostHog can still drive A/B variants for the default-OFF flags.
insert into public.feature_flags (key, enabled_globally, description)
values
  ('flag_new_billing_ux', false,
    'A/B test future cancellation-flow variants (CR-3). Default OFF; PostHog-driven.'),
  ('flag_marketing_site_features_v2', false,
    'Gate a future landing-page revamp (F-001). Default OFF; PostHog-driven.'),
  ('flag_show_playbook_library', true,
    'Kill switch for the Phase 12.5 playbook library. Default ON for all companies.'),
  ('flag_session_replay_enabled', true,
    'Kill switch for PostHog session recording. Default ON; per-company override via enabled_company_ids / enabled.')
on conflict (key) do nothing;
