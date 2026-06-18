# Rollback playbook

How to get TeamApp back to a known-good state when a deploy or the data goes
wrong. Three scenarios, escalating in blast radius and recovery time:

| #   | Scenario                                                                                           | Recovery-time target | Reversible?                                   |
| --- | -------------------------------------------------------------------------------------------------- | -------------------- | --------------------------------------------- |
| A   | [Bad deploy](#scenario-a--bad-deploy)                                                              | **< 5 min**          | Fully                                         |
| B   | [Data corruption](#scenario-b--data-corruption)                                                    | **< 60 min**         | Mostly (data loss limited to RPO)             |
| C   | [Full rollback to legacy Bubble app](#scenario-c--full-platform-rollback-to-the-legacy-bubble-app) | Hours                | Last resort — customers re-enter new-app data |

**Production facts**

- App + marketing are one Next.js app on Vercel, served at **`https://teamapp.ai`**
  (the authenticated app is at **`https://teamapp.ai/app/`** — there is no `app.`
  subdomain).
- Database is Supabase (project: production). Migrations live in `db/migrations/`
  and are applied with the Supabase CLI (`pnpm db:migrate`).
- Health endpoint: `https://teamapp.ai/api/health` (`200 {"status":"ok"}` when the
  DB is reachable).
- Errors report to Sentry; product analytics to PostHog.

**Notification contacts** (fill in real handles before launch)

| Role                     | Who   | Channel               |
| ------------------------ | ----- | --------------------- |
| Incident owner / founder | Phil  | (phone)               |
| On-call engineer         | _TBD_ | Slack `#incidents`    |
| Customer comms           | _TBD_ | email + in-app banner |
| Stripe/billing           | Phil  | (phone)               |

Always post a one-line "investigating" note in `#incidents` the moment you start
any scenario below, and a "resolved" note when done.

---

## Scenario A — Bad deploy

A code/config deploy broke production, but the **database is healthy**.

### Trigger conditions

- Spike of errors in Sentry right after a deploy.
- `https://teamapp.ai/api/health` returns `200` (DB fine) but key pages 500, or a
  smoke check from [`launch-smoke-test.md`](./launch-smoke-test.md) fails.
- A bad env var / build change made the site unusable.

### Steps (target < 5 min)

1. **Announce** in `#incidents`: "Bad deploy, rolling back."
2. **Vercel instant rollback** (this alone fixes most cases):
   - Vercel dashboard → Project → **Deployments**.
   - Find the last known-good deployment (the one before the bad one).
   - **⋯ → Promote to Production** (a.k.a. "Rollback to this deployment").
   - This re-points the `teamapp.ai` production alias at the previous build in
     seconds — no rebuild.
3. **Verify**: hard-reload `https://teamapp.ai`, run checks 1–3 of the smoke list
   (marketing loads, `/api/health` = 200, login works). Confirm Sentry errors
   stop.
4. **Only if the bad deploy also shipped a migration** that the now-restored
   older code can't tolerate, revert the schema too (see below). If the deploy
   was code/config only, you're done — skip this.

### Reverting a migration

Supabase has no automatic "down" migration. Pick the safest option:

- **Preferred — compensating forward migration.** Write a new numbered file in
  `db/migrations/` that undoes the bad change (e.g. drop the column/table/policy
  that was added), then `pnpm db:migrate`. Forward-only keeps history honest.
  Regenerate types afterward: `pnpm db:types`.
- **Additive migrations are usually safe to leave.** A new nullable column or new
  table doesn't break older code — don't bother reverting it; just roll the code
  back.
- **Destructive migration (dropped/renamed/retyped a column with data).** This is
  no longer "just a deploy" — treat it as [Scenario B](#scenario-b--data-corruption)
  and restore via point-in-time recovery, because the data is already gone.

### Who to notify

On-call + incident owner. Customer comms only if the outage lasted long enough to
be noticed (> a few minutes) — a short "brief disruption, resolved" note.

---

## Scenario B — Data corruption

Data was deleted, mangled, or cross-contaminated (bad migration with data loss, a
buggy write path, a bad bulk operation, or an RLS gap that wrote wrong rows). The
**current database can't be trusted**, so we recover to a point in time _before_
the corruption.

### Trigger conditions

- Customers report missing or wrong data (deals vanished, values mangled).
- A migration or script ran a destructive `UPDATE`/`DELETE` without a correct
  `WHERE`.
- Evidence of cross-company data leakage in production.

### Strategy

Restore Supabase **point-in-time recovery (PITR)** into a **separate** project,
investigate there, then promote. Never PITR-overwrite production blind — you'd
destroy the forensic trail and any good data written after the incident.

### Steps (target < 60 min)

1. **Announce + freeze writes.** Post in `#incidents`. To stop further damage,
   put the app in maintenance: in Vercel, set an env flag / promote a maintenance
   deployment, or temporarily disable the affected write path. The goal is to
   stop new writes while you recover.
2. **Pinpoint the time `T`** just _before_ corruption (from Sentry, audit log,
   the offending deploy/script timestamp). Recovery point objective = data
   written between `T` and now may be lost.
3. **Restore to a new project via PITR.** Supabase dashboard → production project
   → **Database → Backups / Point in Time** → restore to timestamp `T`. Restore
   into a **new/separate** project (do not overwrite prod).
4. **Investigate on the restored copy.** Confirm the restored data is intact and
   `T` is early enough. Diff against production to understand exactly what was
   lost/changed.
5. **Promote.** Choose the lowest-risk path:
   - **Surgical (preferred when corruption is scoped):** export the correct rows
     from the restored project and re-import/patch just the affected tables in
     production. Smaller blast radius, keeps post-`T` good data.
   - **Full cutover:** repoint the app's `NEXT_PUBLIC_SUPABASE_URL` /
     `SUPABASE_SERVICE_ROLE_KEY` (and anon key) in Vercel to the restored project
     and redeploy. Use when production is too damaged to patch. Accept loss of
     post-`T` writes.
6. **Lift maintenance**, then run [`launch-smoke-test.md`](./launch-smoke-test.md)
   checks 2–7.
7. **Root-cause** the write path / migration that caused it before re-enabling it.
   If an RLS gap was involved, add a regression test (see
   `tests/regression/cross-company-deal-access.spec.ts`).

### Who to notify

Incident owner immediately. Customer comms is **required** if any customer data
was lost or exposed — be specific about the window (`T` → recovery) and whether
re-entry is needed. Loop in Stripe/billing if subscription/invoice data was
affected.

---

## Scenario C — Full platform rollback to the legacy Bubble app

The new app is fundamentally not working post-cutover and fixing forward isn't
viable within the **14-day cutover window**. Revert customers to the legacy
Bubble application. **This is the last resort** — within the window, customers
will **re-enter any data they created in the new app** during the new-app window,
because that data lives only in Supabase, not Bubble.

### Trigger conditions

- A class of customers cannot complete core work in the new app and neither
  [Scenario A](#scenario-a--bad-deploy) nor [Scenario B](#scenario-b--data-corruption)
  resolves it.
- A severe, unfixable-now defect (data integrity, auth, or billing) with broad
  impact.
- Decision made by the incident owner (Phil) — this is a business call, not just
  an engineering one.

### Steps

1. **Decision + announce.** Incident owner explicitly authorizes the Bubble
   revert. Post in `#incidents` and notify customer comms to prepare outreach.
2. **DNS revert.** Point `teamapp.ai` back to the legacy Bubble app at the DNS
   provider:
   - Restore the previous DNS record(s) for `teamapp.ai` (and `www`) to Bubble's
     target (Bubble CNAME/A record or the values from the pre-cutover DNS
     snapshot).
   - Lower TTL beforehand if you can; expect propagation lag (minutes to up to an
     hour depending on prior TTL).
   - Leave the Vercel app deployed but no longer fronted by `teamapp.ai`, so we
     can still read new-app data from Supabase for migration.
3. **Confirm** the legacy Bubble app serves at `https://teamapp.ai` and customers
   can log in there.
4. **Customer communications** (customer-comms owner): email all active customers
   — what happened, that they're back on the previous system, and that **any work
   entered in the new app between cutover and now must be re-entered**. Provide a
   support contact. If feasible, export new-app data from Supabase (deals,
   activity) and send each team their own records to ease re-entry.
5. **Billing care.** Pause any new-app-initiated Stripe changes if they don't
   match the Bubble billing state; reconcile with Phil before charging anyone.
6. **Post-incident.** Full write-up; do not re-attempt cutover until the
   root-cause class is fixed and re-verified against the smoke suite.

### Who to notify

Everyone: incident owner, on-call, customer comms (all customers), and
Stripe/billing. This is a company-wide event.

---

## After any rollback

- Write a short post-incident note: what happened, trigger, what we did, RTO/RPO
  actually achieved, and the follow-up fix.
- Add or strengthen a test that would have caught it (vitest unit or a
  `tests/regression/*.spec.ts`).
- Re-run the [launch smoke test](./launch-smoke-test.md) before declaring
  resolved.
