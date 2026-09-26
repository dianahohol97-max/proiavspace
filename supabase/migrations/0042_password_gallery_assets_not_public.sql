-- Assets of password-protected galleries are no longer readable by anon.
--
-- "assets: public read in published gallery" used gallery_is_public(), which
-- ignores the password, so anyone with the public anon key could list a
-- password gallery's assets (r2_key, original_name, …) straight from
-- PostgREST without knowing the password.
--
-- The anon policy now covers only open galleries (published, not expired, no
-- password). Password galleries are served by the app after it verifies the
-- HMAC unlock cookie (lib/gallery-access.ts galleryAssetsClient → service role):
-- the public gallery page, /api/galleries/[slug]/archive-urls and
-- /api/assets/[id]/download. Owners keep reading their own rows via
-- "assets: owner select". gallery_is_public() itself is unchanged — the
-- selections RPC and the galleries policy still use it.

create or replace function public.gallery_is_open(gid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.galleries g
    where g.id = gid
      and g.is_published
      and (g.expires_at is null or g.expires_at > now())
      and g.password_hash is null
  );
$$;

revoke execute on function public.gallery_is_open(uuid) from public;
grant execute on function public.gallery_is_open(uuid) to anon, authenticated, service_role;

drop policy if exists "assets: public read in published gallery" on public.assets;

create policy "assets: public read in open gallery" on public.assets
  for select using (public.gallery_is_open(gallery_id));
