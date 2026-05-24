# TeamApp

## Project

TeamApp is a multi-tenant SaaS application built on Next.js 15 (App Router) and
Supabase. It is being built in phases: Phase 0 is the scaffold (this commit) —
tooling, project structure, Supabase client wiring, and a placeholder landing
page, with **no** authentication, database tables, real marketing site, or
third-party integrations yet. The canonical feature spec lives in
[`../TeamApp_Audit_findings.md`](../TeamApp_Audit_findings.md) (parent project
folder) — treat it as the source of truth for what each phase must deliver.

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

## Directory layout

```
app/
  (marketing)/   public landing site (placeholder for now)
  (auth)/        login / signup / forgot-password (Phase 2)
  (app)/         authenticated app shell — sidebar layout (Phase 2+)
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
