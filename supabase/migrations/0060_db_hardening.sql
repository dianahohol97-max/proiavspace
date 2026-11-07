-- Supabase security advisor clean-up (feat/db-hardening).
--
-- 1. function_search_path_mutable: normalize_email and plan_storage_bytes ran
--    with the caller's search_path. Pin it to public. ALTER FUNCTION only
--    attaches the setting; bodies, signatures, volatility and grants stay.
--
-- 2. profiles_clear_free_expiry() is a SECURITY DEFINER trigger function that
--    anon and authenticated could EXECUTE (Supabase's default privileges grant
--    it on every new function; 0049 never revoked it), so it showed up as
--    /rest/v1/rpc/profiles_clear_free_expiry. A trigger function cannot be
--    called outside a trigger, but it has no business being in the API.
--    Postgres checks EXECUTE on a trigger function only at CREATE TRIGGER
--    time, not when the trigger fires, so the profiles trigger keeps working
--    (same pattern as 0011, 0045, 0056, 0057; covered by
--    tests/audit-storage/db-hardening.test.ts).
--
-- Safe for the code currently in production: nothing in the app calls these
-- functions over RPC.
--
-- Rollback:
--   alter function public.normalize_email(text) reset search_path;
--   alter function public.plan_storage_bytes(text) reset search_path;
--   grant execute on function public.profiles_clear_free_expiry()
--     to public, anon, authenticated;

alter function public.normalize_email(text) set search_path = public;
alter function public.plan_storage_bytes(text) set search_path = public;

revoke execute on function public.profiles_clear_free_expiry() from public, anon, authenticated;
