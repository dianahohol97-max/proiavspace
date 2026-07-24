-- Advisor 0011 (function_search_path_mutable): touch_updated_at had no fixed
-- search_path (proconfig was null — the earlier `set search_path = public` in
-- 0011 did not persist). Pin it to empty: the trigger only calls now()
-- (pg_catalog) and writes new.updated_at, so no schema resolution is needed.
alter function public.touch_updated_at() set search_path = '';
