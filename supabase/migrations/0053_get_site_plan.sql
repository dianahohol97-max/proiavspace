-- Public site payload gains the owner's site plan, so a site can tell whether
-- it is on the free tier: «Тиша» shows a small «Сайт на проЯв» credit in the
-- footer only on the free site plan ('site_trial') and never on paid ones.
-- Nothing else about the payload changes (same rows, same trial guard as 0025).
--
-- The return signature gains a column, so the function is dropped and
-- recreated; execute grants are restated for the public roles explicitly.
-- Until this is applied the app reads site_plan as missing and simply hides
-- the credit (fails closed — paid sites never show it).

drop function if exists public.get_site(text);

create function public.get_site(p_handle text)
returns table(
  theme        text,
  mode         text,
  content      jsonb,
  display_name text,
  logo_key     text,
  site_plan    text
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select st.theme, st.mode, st.content, p.display_name, p.logo_url, p.site_plan
  from public.sites st
  join public.profiles p on p.user_id = st.user_id
  where st.handle = p_handle
    and st.is_published
    and not (p.site_plan = 'site_trial' and p.created_at < now() - interval '30 days');
$function$;

grant execute on function public.get_site(text) to anon, authenticated;
