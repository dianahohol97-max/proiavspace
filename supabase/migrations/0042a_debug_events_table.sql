-- debug_events was created by hand on production (outside the migrations), so
-- a clean database never had it and 0043 failed there. This is the table as it
-- exists on production, guarded with IF NOT EXISTS so the migration is a no-op
-- where it already is. Written by /api/debug-log with the service role only.

create table if not exists public.debug_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  url text,
  ua text,
  message text,
  mutations jsonb
);
alter table public.debug_events enable row level security;
