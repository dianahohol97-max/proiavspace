-- Site trial (30 days). The site plan is sold as "1 site for 1 month"; enforce
-- that. Once a profile still on 'site_trial' is older than 30 days (i.e. never
-- upgraded), its site stops being served publicly and drops out of the sitemap.
-- A paid site (site_plan moved off 'site_trial') is unaffected.
--
-- Three layers, all consistent on the same condition:
--   1. get_site / get_published_site_handles hide it at read time (no cron lag);
--   2. expire_trial_sites() flips is_published so the dashboards reflect the
--      "back to draft" state (run daily from the billing cron);
--   3. the save action refuses to (re)publish while expired (in app code).

-- 1. Public site read: hide expired unpaid trials.
create or replace function public.get_site(p_handle text)
returns table(theme text, mode text, content jsonb, display_name text, logo_key text)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select st.theme, st.mode, st.content, p.display_name, p.logo_url
  from public.sites st
  join public.profiles p on p.user_id = st.user_id
  where st.handle = p_handle
    and st.is_published
    and not (p.site_plan = 'site_trial' and p.created_at < now() - interval '30 days');
$function$;

-- Sitemap: same guard so expired trials are not advertised to search engines.
create or replace function public.get_published_site_handles()
returns table(handle text, updated_at timestamp with time zone)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select st.handle, st.updated_at
  from public.sites st
  join public.profiles p on p.user_id = st.user_id
  where st.is_published
    and st.handle is not null
    and not (p.site_plan = 'site_trial' and p.created_at < now() - interval '30 days')
  order by st.updated_at desc
  limit 5000;
$function$;

-- 2. Daily job: turn expired unpaid trial sites back into drafts so the numbers
--    (and the owner's own dashboard) match what the public actually sees.
create or replace function public.expire_trial_sites()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  affected integer;
begin
  update public.sites st
  set is_published = false, updated_at = now()
  from public.profiles p
  where p.user_id = st.user_id
    and st.is_published
    and p.site_plan = 'site_trial'
    and p.created_at < now() - interval '30 days';
  get diagnostics affected = row_count;
  return affected;
end;
$function$;

-- The job is server-only (billing cron via the service role) — never callable
-- by clients.
revoke execute on function public.expire_trial_sites() from public, anon, authenticated;
grant execute on function public.expire_trial_sites() to service_role;
