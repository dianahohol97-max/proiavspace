-- 0065 · Конструктор альбомів, етап 1.1: текст, поворот кадру, корінець,
--        службова галерея альбому не чиститься правилами Free
--
-- Навіщо:
--   1. album_slots.rotation — поворот фото в слоті (90° і вільний, градуси).
--   2. album_spreads.texts — текстові написи розвороту/обкладинки (jsonb-масив,
--      формат у src/lib/album/types.ts AlbumText; до 40 написів).
--      album_spreads.spine_mm — ширина корінця, під яку зверстано обкладинку
--      (коли розворотів більшає, редактор зсуває лицеву сторону на різницю).
--   3. album_print_profiles.cover_spine_per_spread_mm — приріст корінця на
--      кожен розворот (0 = фіксований корінець з cover_spine_mm).
--   4. Службова галерея «порожнього» альбому (фото вантажаться в неї) не
--      закривається й не чиститься за 30 днів Free, поки альбом існує і поки
--      галерея НЕ опублікована. Опублікувала — діють звичайні 30 днів (інакше
--      це був би спосіб тримати клієнтську галерею на Free вічно). Альбом
--      видалили — галерея отримує звичайний строк від моменту видалення.
--      Позначку owns_gallery ставить лише album_create_project (SECURITY
--      DEFINER) — з клієнта її не підробити, тож чужу/клієнтську галерею
--      так не «врятувати».
--   5. album_save_spread — та сама сигнатура, тепер зберігає rotation,
--      texts, spine_mm.
--
-- Безпечно для коду на проді: лише нові колонки з дефолтами, нові функції,
-- create or replace з тими самими сигнатурами. Код альбомів (release/8) без
-- 0065 не збереже текст/поворот (RPC не знає полів) — накочувати разом із
-- 0061–0062 до мержу release/8.
--
-- Відкат:
--   drop trigger if exists galleries_zz_album_service_keep on public.galleries;
--   drop trigger if exists album_projects_service_gallery on public.album_projects;
--   drop trigger if exists album_projects_guard on public.album_projects;
--   drop function if exists public.galleries_album_service_keep();
--   drop function if exists public.album_projects_service_gallery();
--   drop function if exists public.album_projects_guard();
--   drop function if exists public.album_is_service_gallery(uuid);
--   drop function if exists public.album_create_project(text, jsonb, uuid, uuid);
--   alter table public.album_projects drop column if exists owns_gallery;
--   alter table public.album_print_profiles drop column if exists cover_spine_per_spread_mm;
--   alter table public.album_spreads drop column if exists texts, drop column if exists spine_mm;
--   alter table public.album_slots drop column if exists rotation;
--   -- і повернути album_save_spread з 0062.

-- ---------------------------------------------------------------------------
-- 1–3. columns
-- ---------------------------------------------------------------------------
alter table public.album_slots
  add column if not exists rotation numeric(6, 2) not null default 0;
alter table public.album_slots drop constraint if exists album_slots_rotation_range;
alter table public.album_slots
  add constraint album_slots_rotation_range check (rotation between -360 and 360);

alter table public.album_spreads
  add column if not exists texts jsonb not null default '[]'::jsonb,
  add column if not exists spine_mm numeric(5, 1);
alter table public.album_spreads drop constraint if exists album_spreads_texts_shape;
alter table public.album_spreads
  add constraint album_spreads_texts_shape check (
    jsonb_typeof(texts) = 'array'
    and jsonb_array_length(texts) <= 40
    and pg_column_size(texts) <= 65536
  );
alter table public.album_spreads drop constraint if exists album_spreads_spine_range;
alter table public.album_spreads
  add constraint album_spreads_spine_range check (spine_mm is null or spine_mm between 0 and 200);

alter table public.album_print_profiles
  add column if not exists cover_spine_per_spread_mm numeric(4, 2) not null default 0;
alter table public.album_print_profiles drop constraint if exists album_print_profiles_spine_step;
alter table public.album_print_profiles
  add constraint album_print_profiles_spine_step check (cover_spine_per_spread_mm between 0 and 5);

alter table public.album_projects
  add column if not exists owns_gallery boolean not null default false;

-- ---------------------------------------------------------------------------
-- 4. service gallery
-- ---------------------------------------------------------------------------

-- owns_gallery and gallery_id are the server's: the user's client can neither
-- set the mark on insert nor move a project to another gallery later.
create or replace function public.album_projects_guard()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.owns_gallery := false;
    else
      new.owns_gallery := old.owns_gallery;
      new.gallery_id := case when new.gallery_id is null then null else old.gallery_id end;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists album_projects_guard on public.album_projects;
create trigger album_projects_guard
  before insert or update on public.album_projects
  for each row execute function public.album_projects_guard();

create or replace function public.album_is_service_gallery(p_gallery uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.album_projects p
    where p.gallery_id = p_gallery and p.owns_gallery
  );
$$;
revoke all on function public.album_is_service_gallery(uuid) from public, anon, authenticated;

-- Runs after galleries_free_expiry_guard (triggers fire in name order), so it
-- has the last word on the Free deadline of an album's service gallery.
create or replace function public.galleries_album_service_keep()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and public.album_is_service_gallery(new.id) then
    if not new.is_published then
      new.free_expires_at := null;
      new.free_expired_at := null;
    elsif new.free_expires_at is null
          and new.free_purged_at is null
          and not public.owner_has_paid_plan(new.owner_id) then
      -- Published: from now on it is a normal Free gallery.
      new.free_expires_at := now() + interval '30 days';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.galleries_album_service_keep() from public, anon, authenticated;

drop trigger if exists galleries_zz_album_service_keep on public.galleries;
create trigger galleries_zz_album_service_keep
  before update on public.galleries
  for each row execute function public.galleries_album_service_keep();

-- Project created with its own gallery → lift the deadline right away;
-- project deleted → the gallery gets the usual Free term from now.
create or replace function public.album_projects_service_gallery()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.owns_gallery and new.gallery_id is not null then
    -- A no-op update is enough: galleries_zz_album_service_keep decides.
    update public.galleries set free_expires_at = free_expires_at where id = new.gallery_id;
  elsif tg_op = 'DELETE' and old.owns_gallery and old.gallery_id is not null then
    update public.galleries
       set free_expires_at = now() + interval '30 days'
     where id = old.gallery_id
       and free_expires_at is null
       and free_purged_at is null
       and not public.owner_has_paid_plan(owner_id)
       and not public.album_is_service_gallery(id);
  end if;
  return null;
end;
$$;
revoke all on function public.album_projects_service_gallery() from public, anon, authenticated;

drop trigger if exists album_projects_service_gallery on public.album_projects;
create trigger album_projects_service_gallery
  after insert or delete on public.album_projects
  for each row execute function public.album_projects_service_gallery();

-- New album. p_gallery null → a service gallery (unpublished, «Альбом: …») is
-- created and marked as the album's own. Otherwise the gallery must be the
-- caller's. SECURITY DEFINER: checks ownership itself (auth.uid()).
create or replace function public.album_create_project(p_title text, p_spec jsonb, p_profile uuid, p_gallery uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_gallery uuid := p_gallery;
  v_owns boolean := false;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_title is null or char_length(btrim(p_title)) not between 1 and 120 then
    raise exception 'bad_title' using errcode = '22023';
  end if;
  if p_spec is null or jsonb_typeof(p_spec) <> 'object' then
    raise exception 'bad_spec' using errcode = '22023';
  end if;
  if p_profile is not null and not exists (
    select 1 from public.album_print_profiles where id = p_profile and owner_id = v_uid
  ) then
    p_profile := null;
  end if;

  if v_gallery is null then
    insert into public.galleries (owner_id, slug, title)
    values (v_uid, 'albom-' || replace(gen_random_uuid()::text, '-', ''), left('Альбом: ' || btrim(p_title), 200))
    returning id into v_gallery;
    v_owns := true;
  elsif not exists (select 1 from public.galleries where id = v_gallery and owner_id = v_uid) then
    raise exception 'gallery_not_found' using errcode = '42501';
  end if;

  insert into public.album_projects (owner_id, title, profile_id, gallery_id, spec, owns_gallery)
  values (v_uid, btrim(p_title), p_profile, v_gallery, p_spec, v_owns)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.album_create_project(text, jsonb, uuid, uuid) from public, anon;
grant execute on function public.album_create_project(text, jsonb, uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. album_save_spread: + rotation, texts, spine_mm (same signature)
-- ---------------------------------------------------------------------------
create or replace function public.album_save_spread(p_spread jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id       uuid := (p_spread ->> 'id')::uuid;
  v_project  uuid := (p_spread ->> 'project_id')::uuid;
  v_uid      uuid := auth.uid();
  v_slots    jsonb := coalesce(p_spread -> 'slots', '[]'::jsonb);
  v_texts    jsonb := coalesce(p_spread -> 'texts', '[]'::jsonb);
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if jsonb_typeof(v_slots) <> 'array' or jsonb_array_length(v_slots) > 40 then
    raise exception 'too_many_slots' using errcode = '22023';
  end if;
  if (select count(*) from public.album_spreads where project_id = v_project) >= 300
     and not exists (select 1 from public.album_spreads where id = v_id) then
    raise exception 'too_many_spreads' using errcode = '22023';
  end if;

  insert into public.album_spreads as s (id, project_id, owner_id, position, kind, layout, texts, spine_mm)
  values (
    v_id,
    v_project,
    v_uid,
    greatest(coalesce((p_spread ->> 'position')::int, 0), 0),
    coalesce(p_spread ->> 'kind', 'spread'),
    coalesce(nullif(p_spread ->> 'layout', ''), 'blank'),
    v_texts,
    (p_spread ->> 'spine_mm')::numeric
  )
  on conflict (id) do update
    set position = excluded.position,
        kind     = excluded.kind,
        layout   = excluded.layout,
        texts    = excluded.texts,
        spine_mm = excluded.spine_mm
    where s.owner_id = v_uid and s.project_id = v_project;

  if not found then
    raise exception 'spread_not_found' using errcode = '42501';
  end if;

  delete from public.album_slots where spread_id = v_id;

  insert into public.album_slots
    (spread_id, owner_id, position, x_mm, y_mm, w_mm, h_mm, asset_id, zoom, focal_x, focal_y, rotation)
  select v_id, v_uid, r.position, r.x_mm, r.y_mm, r.w_mm, r.h_mm, r.asset_id,
         coalesce(r.zoom, 1), coalesce(r.focal_x, 0.5), coalesce(r.focal_y, 0.5), coalesce(r.rotation, 0)
  from jsonb_to_recordset(v_slots) as r(
    position smallint, x_mm numeric, y_mm numeric, w_mm numeric, h_mm numeric,
    asset_id uuid, zoom numeric, focal_x numeric, focal_y numeric, rotation numeric
  );

  update public.album_projects set updated_at = now() where id = v_project;
end;
$$;

revoke all on function public.album_save_spread(jsonb) from public, anon;
grant execute on function public.album_save_spread(jsonb) to authenticated;
