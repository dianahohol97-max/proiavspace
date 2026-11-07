-- 0054 · «Приховано від клієнта» (під майбутній AI-відбір)
--
-- Навіщо: AI-відбір (і пізніше сам фотограф) зможе прибрати кадр із
-- клієнтської галереї, не видаляючи файл. Прихований кадр власник бачить у
-- кабінеті як завжди; аноніми (публічна галерея, архів «Завантажити все»,
-- вибір, лічильники, обкладинка сайту) — ні.
--
--   assets.hidden_from_client boolean not null default false
--
-- Що змінено на рівні БД:
--   * політика «assets: public read in open gallery» (0042): + not hidden;
--   * set_selection (останній варіант — 0049): прихований кадр не можна
--     обрати («asset_not_in_gallery», як для чужого кадру);
--   * record_gallery_download (0001), record_photo_view (0030): прихований
--     кадр не пишеться в статистику;
--   * get_site_galleries (0006): прихований кадр не стає обкладинкою.
-- Галереї з паролем і завантаження оригіналу читають assets service-роллю
-- (lib/gallery-access.ts) — там фільтр у коді того ж PR
-- (g/[slug]/page.tsx, archive-urls, assets/[id]/download).
-- ТОМУ: цю міграцію накочувати ДО деплою коду гілки db/1 — код фільтрує за
-- колонкою, якої без міграції немає.
--
-- Гранти: assets — табличні (0033), нова колонка читається автоматично.
-- Писати її можуть лише service role (0041 забрав у клієнтів insert/update).
--
-- Відкат (спершу відкотити код, що фільтрує hidden_from_client):
--   drop policy if exists "assets: public read in open gallery" on public.assets;
--   create policy "assets: public read in open gallery" on public.assets
--     for select using (public.gallery_is_open(gallery_id));
--   -- функції: перевиконати їхні тіла з 0049 (set_selection), 0001
--   -- (record_gallery_download), 0030 (record_photo_view), 0006
--   -- (get_site_galleries);
--   alter table public.assets drop column if exists hidden_from_client;

alter table public.assets
  add column if not exists hidden_from_client boolean not null default false;

-- Публічна галерея читає кадри по gallery_id; частковий індекс не потрібен —
-- assets_gallery_idx уже звужує до однієї галереї.

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
drop policy if exists "assets: public read in open gallery" on public.assets;
create policy "assets: public read in open gallery" on public.assets
  for select using (public.gallery_is_open(gallery_id) and not hidden_from_client);

-- ---------------------------------------------------------------------------
-- Функції, які анонім викликає з id кадру
-- ---------------------------------------------------------------------------
create or replace function public.set_selection(
  p_slug text,
  p_asset uuid,
  p_kind text,
  p_selected boolean,
  p_token text
) returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_gallery uuid;
begin
  if coalesce(trim(p_token), '') = '' then
    raise exception 'missing_token';
  end if;
  if p_kind not in ('favorite', 'retouch') then
    raise exception 'bad_kind';
  end if;

  select g.id into v_gallery
  from public.galleries g
  where g.slug = p_slug
    and g.is_published
    and (g.expires_at is null or g.expires_at > now())
    and g.free_expired_at is null
    and not public.owner_galleries_closed(g.owner_id);
  if v_gallery is null then
    raise exception 'gallery_not_available';
  end if;

  -- The asset must belong to this gallery and be visible to the client.
  if not exists (
    select 1 from public.assets a
     where a.id = p_asset and a.gallery_id = v_gallery and not a.hidden_from_client
  ) then
    raise exception 'asset_not_in_gallery';
  end if;

  if p_selected then
    insert into public.selections (gallery_id, asset_id, client_token, kind)
    values (v_gallery, p_asset, p_token, p_kind)
    on conflict (asset_id, client_token, kind) do nothing;
  else
    delete from public.selections
    where asset_id = p_asset and client_token = p_token and kind = p_kind;
  end if;
end;
$function$;

create or replace function public.record_gallery_download(gid uuid, asset uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.gallery_is_public(gid) then
    return;
  end if;
  if exists (
    select 1 from public.assets a where a.id = asset and a.hidden_from_client
  ) then
    return;
  end if;
  insert into public.gallery_events (gallery_id, type, meta)
    values (gid, 'download', jsonb_build_object('asset_id', asset));
end;
$$;

create or replace function public.record_photo_view(p_slug text, p_asset uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  gid uuid;
begin
  select id into gid from public.galleries
    where slug = p_slug and is_published
      and (expires_at is null or expires_at > now());
  if gid is null then
    return;
  end if;
  if exists (
    select 1 from public.assets a where a.id = p_asset and a.hidden_from_client
  ) then
    return;
  end if;
  insert into public.gallery_events (gallery_id, type, meta)
    values (gid, 'view', jsonb_build_object('asset_id', p_asset));
end;
$$;
revoke execute on function public.record_photo_view(text, uuid) from public;
grant execute on function public.record_photo_view(text, uuid) to anon, authenticated;

-- Site portfolio block: a hidden explicit cover falls back to the first
-- visible frame.
create or replace function public.get_site_galleries(p_handle text)
returns table (
  slug        text,
  title       text,
  preview_key text
)
language sql
security definer set search_path = public
stable
as $$
  select g.slug, g.title, cover.k
  from public.sites st
  join public.galleries g
    on g.owner_id = st.user_id
   and g.is_published
   and (g.expires_at is null or g.expires_at > now())
  left join lateral (
    select coalesce(x.variants ->> 'preview', x.r2_key) as k
    from public.assets x
    where x.gallery_id = g.id
      and not x.hidden_from_client
    order by (x.id = g.cover_asset_id) desc, x.position, x.created_at
    limit 1
  ) cover on true
  where st.handle = p_handle and st.is_published
  order by g.created_at desc
  limit 12;
$$;
