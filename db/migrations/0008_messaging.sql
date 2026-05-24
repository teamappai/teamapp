-- 0008_messaging.sql
-- In-app messaging with threads, participants, threaded replies, and reactions
-- (audit F-091).

-- ── message_threads ───────────────────────────────────────────────────────────
create table if not exists public.message_threads (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  type       public.message_thread_type not null,
  name       text,                          -- NULL for direct messages
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_message_threads_updated_at on public.message_threads;
create trigger set_message_threads_updated_at
  before update on public.message_threads
  for each row execute function public.set_updated_at();

-- ── message_thread_participants ───────────────────────────────────────────────
create table if not exists public.message_thread_participants (
  thread_id             uuid not null references public.message_threads (id) on delete cascade,
  user_id               uuid not null references public.users (id) on delete cascade,
  joined_at             timestamptz not null default now(),
  last_read_at          timestamptz,
  notifications_enabled boolean not null default true,
  primary key (thread_id, user_id)
);

-- ── messages ──────────────────────────────────────────────────────────────────
create table if not exists public.messages (
  id                  uuid primary key default gen_random_uuid(),
  thread_id           uuid not null references public.message_threads (id) on delete cascade,
  sender_id           uuid references public.users (id) on delete set null,
  body                text,
  attachments         jsonb not null default '[]'::jsonb,
  reply_to_message_id uuid references public.messages (id) on delete set null,
  edited_at           timestamptz,
  deleted_at          timestamptz,
  created_at          timestamptz not null default now()
);

-- ── message_reactions (audit F-091) ───────────────────────────────────────────
create table if not exists public.message_reactions (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id    uuid not null references public.users (id) on delete cascade,
  emoji      text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);
