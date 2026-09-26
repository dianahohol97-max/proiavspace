-- debug_events: no direct inserts from the public key.
--
-- The table was created outside the migrations with an
-- "anyone can insert" policy (anon, authenticated, check = true), so anyone
-- holding the public anon key could write rows of any size straight through
-- PostgREST. /api/debug-log now writes with the service role only, behind a
-- body-size cap and an hourly ceiling, so the public insert path is dropped.

drop policy if exists "debug_events: anyone can insert" on public.debug_events;
revoke insert on public.debug_events from anon, authenticated;
