# PostHog Analytics (Phase 15)

Product analytics, session replay, and feature flags for TeamApp. This document
is the source of truth for **what we instrument** and **how the pieces fit**.
The canonical event/property contract lives in code at
[`lib/posthog/types.ts`](./types.ts) — this README narrates it.

---

## Setup

### Environment variables

Set these in `.env.local` (see `.env.local.example`). Validated lazily and
non-throwingly in [`lib/env.ts`](../env.ts) — when unset, analytics simply
no-ops, so local dev and CI work without a PostHog project.

| Variable                   | Exposure        | Purpose                                           |
| -------------------------- | --------------- | ------------------------------------------------- |
| `NEXT_PUBLIC_POSTHOG_KEY`  | client + server | Project API key — client + server event ingest    |
| `NEXT_PUBLIC_POSTHOG_HOST` | client + server | API host (`https://us.i.posthog.com`)             |
| `POSTHOG_PERSONAL_API_KEY` | **server only** | Personal API key — server-side feature-flag reads |

The Personal API Key is scoped to `feature_flag:read` only and is **never**
exposed to the browser.

### Account structure

Use **two** PostHog projects: `teamapp-dev` (local + preview) and `teamapp-prod`
(production). They keep test/replay data out of production analytics. The key in
each environment's `.env`/secrets selects the project.

### Initialization

- **Browser**: [`components/posthog-provider.tsx`](../../components/posthog-provider.tsx)
  calls `posthog.init` once on mount and wraps the tree in `PostHogProvider`.
  It is mounted in [`app/layout.tsx`](../../app/layout.tsx).
- **Server**: [`lib/posthog/server.ts`](./server.ts) creates a per-request
  `posthog-node` client with `flushAt: 1` / `flushInterval: 0` and always calls
  `shutdown()` after capture (serverless flush guarantee). Use the
  `captureServer(event, props, distinctId, groups?)` helper — it encapsulates the
  create → capture → shutdown lifecycle and is a no-op when unconfigured.

---

## Event Taxonomy

27 events, `noun_verb_past_tense`, snake_case. Capture via the **typed** helpers
(`capture` from `lib/posthog/client` on the browser, `captureServer` from
`lib/posthog/server` on the server) so payloads are checked against
`EventMap`. Always pass `groups: { company: <companyId> }` on server captures for
multi-tenant cohort analysis.

| Event                           | Where                                          | Key properties                                                                                                         |
| ------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `login_attempted`               | client (login form)                            | `device_type`, `browser`, `success`                                                                                    |
| `login_failed`                  | client (login form, error path)                | `device_type`, `error_code`, `error_message`                                                                           |
| `training_module_viewed`        | server (`recordModuleView`)                    | `module_id`, `section_id`, `role`                                                                                      |
| `training_module_completed`     | server (`markModuleComplete`)                  | `module_id`, `section_id`, `time_to_complete_seconds`                                                                  |
| `training_section_completed`    | server (last module in section)                | `section_id`, `modules_count`                                                                                          |
| `activity_log_opened`           | client (activity-log page)                     | `source`, `role`                                                                                                       |
| `activity_log_submitted`        | server (`submitActivityLog`)                   | all metric counts, `total_activities`, `streak_day_count`, `is_off_day`                                                |
| `activity_log_streak_broken`    | server (`submitActivityLog`, gap detected)     | `previous_streak`, `last_logged_at`, `agent_id`                                                                        |
| `deal_form_opened`              | client (deals/new page)                        | `source`                                                                                                               |
| `deal_ai_extraction_completed`  | server (`/api/deals/extract`)                  | `fields_extracted_count`, `fields_corrected_count`, `file_count`                                                       |
| `deal_submitted`                | server (`submitDeal`, client meta)             | `representing`, `sales_price_cents`, `gci_cents`, `has_ai_extracted_fields`, `time_in_form_seconds`, `stage_at_submit` |
| `deal_form_abandoned`           | client (wizard `beforeunload`)                 | `last_field_touched`, `time_in_form_seconds`, `fields_filled_count`                                                    |
| `request_created`               | server (`createRequest`)                       | `request_type`, `assigned_to_role`, `has_attachments`, `has_due_date`                                                  |
| `request_status_changed`        | server (`changeRequestStatus`)                 | `request_id`, `from_status`, `to_status`                                                                               |
| `request_completed`             | server (`changeRequestStatus` → completed)     | `request_type`, `time_open_hours`                                                                                      |
| `coaching_dashboard_viewed`     | client (coaching page)                         | `role`, `date_range_filter`                                                                                            |
| `coaching_funnel_stage_drilled` | client (funnel bar click)                      | `stage_name`                                                                                                           |
| `agent_nudge_sent`              | server (`sendNudge`)                           | `agent_id`, `nudge_type`                                                                                               |
| `billing_dashboard_viewed`      | client (billing page)                          | —                                                                                                                      |
| `unsubscribe_initiated`         | client (cancel link)                           | —                                                                                                                      |
| `unsubscribe_completed`         | server (Stripe webhook `subscription.deleted`) | `company_id`                                                                                                           |
| `seats_added`                   | server (`changePlan`, seats grew)              | `seats_added_count`, `new_total_seats`                                                                                 |
| `channel_joined`                | server (`joinChannel` / `addChannelMembers`)   | `channel_id`, `channel_type`, `source`                                                                                 |
| `mention_sent`                  | server (`sendMessage`)                         | `mention_type`, `channel_id`                                                                                           |
| `playbook_browsed`              | client (playbooks page)                        | `source`                                                                                                               |
| `playbook_installed`            | server (`installPlaybookAction`)               | `playbook_id`, `install_count_after`                                                                                   |
| `placeholder_content_viewed`    | client (paranoia bug-catcher)                  | `content_text`, `location`                                                                                             |

> `placeholder_content_viewed` is a **paranoia** event: it fires once per session
> if rendered authored content matches `/TODO|TBD|\{\{|Lorem ipsum/i` (see
> [`placeholder-detector.ts`](./placeholder-detector.ts)). A single prod
> occurrence means a content bug shipped. Keep its scope narrow — it is wired
> only into the training module renderer.

---

## Identifying Users & Companies

Decision 6 (login + hydration). The server resolves the user + company shape and
renders [`<Identify>`](../../components/posthog/identify.tsx) inside the
authenticated shell ([`app/app/layout.tsx`](../../app/app/layout.tsx)). On mount
it calls `identifyUser` + `identifyCompany` **only if** the PostHog distinct_id
doesn't already match the user — catching both fresh logins and refreshed
sessions without re-identifying on every navigation.

- `identifyUser(user)` → `posthog.identify(id, { email, role, company_id, joined_at })`
- `identifyCompany(company)` → `posthog.group('company', id, { name, plan, seats_used, seats_total, mrr, signed_up_at })`
- `resetIdentity()` → `posthog.reset()` — called on the Sign-out form submit
  ([`components/layout/header.tsx`](../../components/layout/header.tsx)).

`seats_used` and `mrr` are **derived** (not stored columns) in
[`lib/posthog/company.ts`](./company.ts): `seats_used` counts active members,
`mrr` is normalized to a monthly figure from `lib/billing/plans.ts`.

Identify is skipped while a super_admin is **impersonating** so their analytics
identity isn't overwritten by the impersonated user.

---

## Privacy & PII Masking

Session replay runs with `maskAllInputs: true` (all `<input>`/`<textarea>` masked
in recordings) plus `maskTextSelector: '[data-ph-mask]'` for rendered PII **text**.

### `data-ph-mask` (rendered text masked in replay)

| Location                         | File                                            |
| -------------------------------- | ----------------------------------------------- |
| Message bodies                   | `components/messages/markdown-message.tsx`      |
| Coaching note bodies             | `components/coaching/coaching-log.tsx`          |
| Coaching reply bodies            | `components/coaching/coaching-reply-thread.tsx` |
| Deal client name (detail header) | `components/deals/deal-detail.tsx`              |
| Deal client name (table)         | `components/deals/deals-table.tsx`              |

### `data-ph-no-capture` (inputs excluded from autocapture)

| Field                                            | File                                            |
| ------------------------------------------------ | ----------------------------------------------- |
| License number                                   | `app/app/profile/profile-form.tsx`              |
| Deal client first/last/email/phone (wizard)      | `components/deals/deal-wizard.tsx`              |
| Deal client first/last/email/phone (detail edit) | `components/deals/deal-detail.tsx`              |
| Deal comment textarea                            | `components/deals/deal-detail.tsx`              |
| Coaching note compose                            | `components/coaching/coaching-note-dialog.tsx`  |
| Coaching reply compose                           | `components/coaching/coaching-reply-thread.tsx` |
| Message composer textarea                        | `components/messages/composer.tsx`              |

> Stripe payment fields render inside Stripe Elements iframes, which Stripe masks
> from third-party scripts — no extra attribute needed.

When adding a screen that renders client PII or financial detail, add
`data-ph-mask` to the text node (or `data-ph-no-capture` to the input) and update
this table.

---

## Feature Flags

Hybrid resolver (Decision 4) in [`lib/flags/index.ts`](../flags/index.ts). Server
only — never import from a client component.

```
getFlag(key, { userId, companyId })
  1. public.feature_flags row for `key`:
       enabled === false           → false   (explicit kill switch)
       enabled === true            → true     (explicit force-on)
       enabled_globally === true   → true     (on for everyone)
       companyId ∈ enabled_company_ids → true (per-company allowlist)
       else                        → fall through
  2. PostHog (posthog-node, Personal API Key, groups: { company })
  3. default false
```

A 60-second in-process LRU cache keyed by `${key}:${userId}:${companyId}` keeps
the DB + PostHog round-trips off the hot path. `isFlagEnabled` is the boolean
convenience wrapper.

**Client-side** flag reads go through the PostHog browser SDK directly
(`posthog.isFeatureEnabled(key)`), which caches internally. For DB-controlled
flags the client must know about, server-render the resolved state.

### Initial flag set (migration `0029_flags_seed.sql`)

| Flag                              | Default | Purpose                                                  |
| --------------------------------- | ------- | -------------------------------------------------------- |
| `flag_new_billing_ux`             | OFF     | A/B test future cancellation-flow variants (CR-3)        |
| `flag_marketing_site_features_v2` | OFF     | Gate a future landing-page revamp (F-001)                |
| `flag_show_playbook_library`      | ON      | Kill switch for the Phase 12.5 playbook library          |
| `flag_session_replay_enabled`     | ON      | Kill switch for session recording (per-company override) |

`flag_show_playbook_library` gates `/app/playbooks` (shows "Coming soon" when
off). `flag_session_replay_enabled` is read client-side in the provider's
`onFeatureFlags` callback and stops recording when explicitly disabled.

### Adding a new flag

1. Add a row to `feature_flags` (migration or super_admin UI): set
   `enabled_globally` for the default, optionally `enabled_company_ids`.
2. Register the same key in the PostHog UI (boolean) for experiment-style
   targeting.
3. Read it with `getFlag`/`isFlagEnabled` (server) or `posthog.isFeatureEnabled`
   (client).

### PostHog UI flag setup (manual, post-phase)

Register all four flags in **both** PostHog projects, boolean type:
default `false` except `flag_show_playbook_library` and
`flag_session_replay_enabled` (default `true`).

---

## Cohorts (Configure Post-Launch)

Define these in the PostHog UI (not created by this phase):

1. **Active agents** — logged activity in last 7 days
2. **At-risk agents** — no activity 7+ days OR onboarding stalled 14+ days
3. **Onboarding complete** — finished the Onboarding section
4. **High performers** — 5+ closed deals YTD
5. **At-risk customers** (company group) — seat usage <50% OR no deal in 30 days OR billing failure
6. **Mobile users** — sessions on a mobile device
7. **Trial / new accounts** — created in last 30 days

## Funnels (Configure Post-Launch)

1. **New-agent onboarding** — invite accepted → first `training_module_viewed` → 3+ modules completed → first `deal_submitted` → first `activity_log_submitted`
2. **Daily Activity Log adoption** — `activity_log_submitted` Day 1 → 2 → 3 → 7 → 14 → 30
3. **Deal creation** — `deal_form_opened` → `deal_ai_extraction_completed` (or skip) → `deal_submitted`
4. **Billing intent** — `billing_dashboard_viewed` → `unsubscribe_initiated` → `unsubscribe_completed`; and `seat_limit_warning_shown` → `seats_added`
5. **Coaching engagement** — `coaching_dashboard_viewed` → `coaching_funnel_stage_drilled` → `agent_nudge_sent`

Event names above match `EventMap` exactly so the funnels resolve.

---

## Troubleshooting

- **Events not appearing in Live**: confirm `NEXT_PUBLIC_POSTHOG_KEY` is set in
  the running environment (it's inlined at build time — restart `pnpm dev` after
  editing `.env.local`). Server events require the request to complete so
  `captureServer` can `shutdown()`/flush.
- **Identify not working**: the provider's `posthog.init` must finish before
  `<Identify>` runs — it defers one tick if `__loaded` is false. Check that the
  user isn't impersonating (identify is skipped). Verify `distinct_id` in the
  PostHog toolbar matches `user.id`.
- **Flag not evaluating**: the resolver checks the DB first — an
  `enabled`/`enabled_globally` row will short-circuit PostHog. Clear the
  60s cache by waiting or restarting the server. Confirm
  `POSTHOG_PERSONAL_API_KEY` is set for PostHog-side evaluation.
- **Session replay shows PII**: confirm the element carries `data-ph-mask`
  (text) or the input is within `maskAllInputs` scope / has `data-ph-no-capture`.
