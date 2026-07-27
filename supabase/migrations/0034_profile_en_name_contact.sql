-- Two public-gallery branding additions:
--   1) display_name_en — the photographer's name in Latin script, shown on
--      English-locale galleries (brand + watermark stay per-upload).
--   2) contact_url — one link («звʼязатися з фотографом») surfaced in the
--      gallery footer: Instagram, site, mailto: or tel:.
-- profiles carries TABLE-level grants (attacl empty), new columns auto-covered.
alter table public.profiles
  add column if not exists display_name_en text,
  add column if not exists contact_url text;

-- get_gallery_branding gains both fields (append-only: existing callers
-- destructure by name and keep working).
drop function if exists public.get_gallery_branding(text);
create function public.get_gallery_branding(gallery_slug text)
returns table (
  display_name    text,
  display_name_en text,
  logo_key        text,
  plan            text,
  grace_until     timestamptz,
  site_theme      text,
  site_mode       text,
  tip_link        text,
  contact_url     text
)
language sql
security definer set search_path = public
stable
as $$
  select
    p.display_name,
    p.display_name_en,
    p.logo_url,
    p.plan,
    p.grace_until,
    st.theme,
    st.mode,
    case when bs.manual_link_enabled then bs.manual_link end,
    p.contact_url
  from public.galleries g
  join public.profiles p on p.user_id = g.owner_id
  left join public.sites st on st.user_id = g.owner_id
  left join public.booking_settings bs on bs.user_id = g.owner_id
  where g.slug = gallery_slug
    and g.is_published
    and (g.expires_at is null or g.expires_at > now());
$$;
