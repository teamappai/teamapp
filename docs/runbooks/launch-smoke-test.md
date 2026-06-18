# Launch smoke test — manual checklist

Run this **by hand against the live production domain (`https://teamapp.ai`)**
immediately after cutover, and again after any production deploy that touches a
critical path. It complements the automated Playwright smoke suite
(`tests/smoke/*.spec.ts`), which runs against staging — this list verifies the
real production wiring (DNS, env vars, Stripe live mode, Resend, Sentry) that CI
can't reach.

- **Time budget:** ~15 minutes.
- **The app lives at `https://teamapp.ai/app/`.** There is no `app.` subdomain —
  if anything points at `app.teamapp.ai`, that's a misconfiguration.
- **Use a real test account**, not a customer account. Have the seed/dev
  password and a throwaway email inbox you control ready.

> If any **bold "Pass:"** check fails, stop and consult
> [`rollback.md`](./rollback.md) before continuing.

---

## 0. Pre-flight

- [ ] Confirm the deploy finished in Vercel and the production alias points at
      the new deployment.
- [ ] Confirm the production env has the live Supabase, Stripe **live-mode**,
      Resend, PostHog, and Sentry keys set (see CLAUDE.md → Operations for where
      env vars live).

## 1. Marketing site loads

- [ ] Open `https://teamapp.ai/` in a fresh incognito window.
- [ ] **Pass:** the landing page renders with styling, pricing reads from the
      plan cards (Launch $245 / Pro $595), and there are no console errors.
- [ ] Open `https://teamapp.ai/pricing` — prices match `lib/billing/plans.ts`.

## 2. Health check

- [ ] `curl -s -o /dev/null -w "%{http_code}\n" https://teamapp.ai/api/health`
- [ ] **Pass:** returns `200` and body `{"status":"ok"}`. A `503` means the app
      can't reach the database — do not proceed; see rollback.

## 3. Log in

- [ ] Go to `https://teamapp.ai/login`, sign in with the test account.
- [ ] **Pass:** lands inside `/app/` (a `super_admin` account is routed to the
      2FA challenge/setup — that still proves auth works).

## 4. Submit a real deal

- [ ] As an agent, go to `/app/deals/new` → **Enter manually**.
- [ ] Fill a property address, client name, representing = Buyer, an RPA signed
      date, then **Create deal**.
- [ ] **Pass:** redirects to the new deal detail page and the address shows.
- [ ] (Optional) Upload a sample contract PDF and confirm AI extraction returns
      fields for confirmation (do not trust values — SR-1).

## 5. Log activity

- [ ] Go to `/app/activity-log`, increment a metric, **Submit activity**.
- [ ] **Pass:** success toast; reloading shows today's values retained.

## 6. Send a message

- [ ] Go to `/app/messages`, open a conversation, type a message, send.
- [ ] **Pass:** the message appears in the thread.

## 7. View billing

- [ ] As a team lead, go to `/app/billing`.
- [ ] **Pass:** the plan, seat usage, and tabs render without error.

## 8. Stripe checkout — LIVE mode

> This charges a real card. Use a real card you control and refund/cancel after,
> or use Stripe's live-mode test clock if configured. Confirm you are in **live
> mode** (keys start `sk_live_` / `pk_live_`), not test mode.

- [ ] From `/app/billing`, start an upgrade/checkout and complete it with a real
      card.
- [ ] **Pass:** checkout succeeds and returns to the app.
- [ ] In the Stripe **live** dashboard, confirm the subscription was created and
      the `customer.subscription.created` webhook delivered `200` to
      `https://teamapp.ai/api/stripe/webhook`.
- [ ] Back in `/app/billing`, the plan/seat state reflects the change.
- [ ] Clean up: cancel/refund the test subscription.

## 9. Resend invitation email

- [ ] As a team lead, invite a user to a throwaway inbox you control.
- [ ] **Pass:** the invitation email arrives within a couple of minutes, lands in
      the **inbox (not spam)**, the sender/domain looks right, and the
      accept-invite link goes to `https://teamapp.ai/accept-invite?...`.
- [ ] Click through and confirm the signup page loads.

## 10. Error reporting (Sentry)

- [ ] Confirm in Sentry that a release was created for this deploy and source
      maps uploaded (errors symbolicate).
- [ ] (Optional) Trigger a known test error and confirm it appears in Sentry with
      PII scrubbed (no request bodies, client names/emails/phones, license
      numbers, or message contents).

---

## Sign-off

| Check         | Owner | Result |
| ------------- | ----- | ------ |
| 1 Marketing   |       |        |
| 2 Health      |       |        |
| 3 Login       |       |        |
| 4 Deal        |       |        |
| 5 Activity    |       |        |
| 6 Message     |       |        |
| 7 Billing     |       |        |
| 8 Stripe live |       |        |
| 9 Resend      |       |        |
| 10 Sentry     |       |        |

All green → announce launch. Any red → see [`rollback.md`](./rollback.md).
