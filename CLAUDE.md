# TeamApp

## Project

TeamApp is a multi-tenant SaaS application built on Next.js 15 (App Router) and
Supabase. It is being built in phases: Phase 0 is the scaffold (this commit) —
tooling, project structure, Supabase client wiring, and a placeholder landing
page, with **no** authentication, database tables, real marketing site, or
third-party integrations yet. The canonical feature spec lives in
[`../TeamApp_Audit_findings.md`](../TeamApp_Audit_findings.md) (parent project
folder) — treat it as the source of truth for what each phase must deliver.

## Pricing — Source of Truth

Canonical pricing lives in [`lib/billing/plans.ts`](lib/billing/plans.ts).

> **All pricing displays in marketing, app billing UI, Stripe products, and
> analytics MUST read from `/lib/billing/plans.ts`. Hardcoding prices anywhere
> else is a bug.**

All money is stored as integer **cents** (never floats). Current plans (base
monthly price, for quick human reference only — the file is authoritative):

| Plan id     | Monthly | Included seats |
| ----------- | ------- | -------------- |
| `launch`    | $250    | 10             |
| `pro`       | $595    | 25             |
| `brokerage` | $1,500  | 100            |

Annual billing is ~20% off 12× monthly. Stripe price IDs in `plans.ts` are
`null` and get filled in during Phase 12.

## Tech stack

| Concern         | Choice                                                      |
| --------------- | ----------------------------------------------------------- |
| Framework       | Next.js 15 (App Router, React Server Components by default) |
| Language        | TypeScript (strict mode)                                    |
| UI runtime      | React 19                                                    |
| Styling         | Tailwind CSS v4                                             |
| Components      | shadcn/ui (New York style, Slate base, CSS variables)       |
| Backend / DB    | Supabase (`@supabase/supabase-js` + `@supabase/ssr`)        |
| Package manager | pnpm (commit only `pnpm-lock.yaml`)                         |
| Lint / format   | ESLint (Next preset) + Prettier (+ Tailwind plugin)         |
| Git hooks       | Husky + lint-staged (pre-commit: eslint --fix + prettier)   |

## Local dev environment

- Node 22.13+ required (pnpm 11 dependency)
- pnpm: per package.json's packageManager field
- Mac dev tip: nvm install 22 && nvm use 22

## Directory layout

```
app/
  (marketing)/   public landing site (placeholder for now)
  (auth)/        login / signup / forgot-password / reset-password (Phase 2)
  app/           authenticated app — URL prefix /app/* (dashboard, admin,
                 profile). A literal segment (NOT a route group) so the spec's
                 /app/* paths are real URLs; middleware gates everything here.
  auth/confirm/  email-link callback (recovery + email-change verifyOtp/PKCE)
  accept-invite/ invitation entry → validates token → /signup
  logout/        POST-only sign-out → /
  api/           route handlers
components/
  ui/            shadcn primitives (added via `pnpm dlx shadcn@2 add <name>`)
  layout/        sidebar, header, app chrome
  shared/        reusable cross-feature components
lib/
  supabase/      client.ts (browser) · server.ts (RSC/route handlers) ·
                 service.ts (service-role, server-only) · middleware.ts (session refresh)
  utils/         date, currency, role helpers (+ shadcn `cn`)
  constants/     role names, plan tiers, etc.
db/
  migrations/    numbered SQL migrations
  seed/          seed scripts
types/           generated Supabase types (types/supabase.ts)
middleware.ts    refreshes the Supabase session on every request
```

### Supabase client boundary

- `lib/supabase/client.ts` — browser client (anon key). Marked `client-only`.
- `lib/supabase/server.ts` — server client (anon key, cookie-based). Marked `server-only`.
- `lib/supabase/service.ts` — service-role client. Marked `server-only`, and an
  ESLint rule additionally blocks importing it from `components/**`.
  **Never** import this into client code — it bypasses Row Level Security.

## Authentication (Phase 2)

Auth is Supabase Auth + `@supabase/ssr`. Signup is **invite-only**: there is no
public registration. `app/(auth)/actions.ts` holds the server actions (sign-in,
password reset, accept-invitation); profile/2FA actions live in
`app/app/profile/actions.ts`. Zod schemas are shared between client forms and
server actions in `lib/validations/auth.ts`.

- **Role homes** (`lib/constants/roles.ts`): `super_admin → /app/admin`, everyone
  else `→ /app/dashboard`.
- **Middleware** (`lib/supabase/middleware.ts`) refreshes the session and gates
  routes: unauthenticated `/app/*` → `/login?next=…`; authenticated on
  `/login`/`/signup` → role home; `super_admin` without a verified TOTP factor is
  forced to `/app/profile/2fa-required` (audit F-008).
- **Profiles are not auto-created** — there is no `auth.users` trigger.
  `acceptInvitation` creates the auth user **and** the `public.users` row with
  the service-role client, then signs in. Mirror this pattern for any other
  server-side user creation.
- **Email change** uses `updateUser({ email })` (verification-gated). The
  `public.users.email` mirror is **not** synced until confirmation — wire a
  webhook/trigger in a later phase if the mirror must stay current.

### Supabase email templates (configure in the Dashboard)

Custom transactional emails (invitations, etc.) will use Resend later. For now
we rely on Supabase's built-in templates — customize them in
**Dashboard → Authentication → Email Templates** with the TeamApp logo and a
clean text-only layout. Point the action links at the confirm route so the SSR
session is established correctly:

| Template           | Confirmation URL to set                                                                       |
| ------------------ | --------------------------------------------------------------------------------------------- |
| **Reset Password** | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`  |
| **Change Email**   | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change&next=/app/profile` |

`/auth/confirm` (`app/auth/confirm/route.ts`) accepts both the `token_hash`
(`verifyOtp`) and `code` (PKCE `exchangeCodeForSession`) link formats, so either
Supabase default works. Set **Site URL** and **Redirect URLs** to include the
app origin (`NEXT_PUBLIC_APP_URL`) plus `…/auth/confirm` and `…/reset-password`.

## Commands

| Command             | What it does                                          |
| ------------------- | ----------------------------------------------------- |
| `pnpm dev`          | Start the dev server on http://localhost:3000         |
| `pnpm build`        | Production build                                      |
| `pnpm start`        | Run the production build                              |
| `pnpm lint`         | ESLint                                                |
| `pnpm typecheck`    | `tsc --noEmit`                                        |
| `pnpm format`       | Prettier write across the repo                        |
| `pnpm format:check` | Prettier check (no writes)                            |
| `pnpm test`         | Test suite (placeholder until a runner is added)      |
| `pnpm db:types`     | Regenerate `types/supabase.ts` from the remote schema |
| `pnpm db:migrate`   | Push migrations (`supabase db push`)                  |
| `pnpm db:reset`     | Reset the local DB and re-run migrations + seeds      |
| `pnpm db:seed`      | Seed test accounts + sample data (`db/seed/seed.ts`)  |

> The `db:*` scripts require the Supabase CLI installed and a linked project.
> Migrations are authored in `db/migrations/` (the canonical location);
> `supabase/migrations` is a symlink to it so the CLI picks them up.
> `db/seed/seed.ts` and `scripts/*.ts` run under `tsx` and read `.env.local`.

## Before you change anything

1. `pnpm typecheck` — must pass clean.
2. `pnpm lint` — must pass clean.
3. `pnpm test` — must pass.
4. After **any** database change (migration, schema edit), regenerate types:
   `pnpm db:types`, and review the diff in `types/supabase.ts`.
5. Keep the `client` / `server` / `service` Supabase boundary intact — never
   import `service.ts` or `server.ts` from a Client Component.

## Pre-launch follow-ups

- **Verify the Supabase email template + URL configuration end-to-end** — the
  **Reset Password** and **Confirm Email Change** templates point at
  `/auth/confirm` (see "Supabase email templates" above), and the **Site URL** +
  **Redirect URLs** allowlist includes `…/auth/confirm` (and `…/reset-password`).
  Run a real reset and a real email-change through to confirm the SSR session is
  established correctly.
- **Add a `public.users.email` mirror trigger from `auth.users.email`** (target:
  Phase 12). Email changes go through `updateUser({ email })` and are only
  reflected in `auth.users` on confirmation; the `public.users.email` mirror is
  not synced until a trigger/webhook keeps it current.
