-- 0062 · Конструктор альбомів, етап 1: розвороти і слоти + атомарне збереження
--
-- Навіщо: розворот альбому (або обкладинка) — це розкладка (layout, id
-- шаблону з src/lib/album/templates.ts) і набір слотів. Слот — прямокутник у
-- мм від лівого верхнього кута лінії обрізу (може виходити у виліт, тоді x/y
-- від'ємні), фото з галереї (asset_id) і кадрування: zoom ≥ 1 поверх «cover»
-- та фокусна точка (focal_x/focal_y, 0..1 у координатах кадру — ця точка
-- стоїть у центрі слота, наскільки дозволяють краї).
--
-- Редактор зберігає розворот цілком: album_save_spread(jsonb) у одній
-- транзакції оновлює розворот і замінює всі його слоти, тож напівзбережених
-- розворотів не буває. album_sync_spreads(project, ids[]) задає порядок і
-- прибирає видалені розвороти. Обидві функції SECURITY INVOKER — права
-- перевіряє RLS, як і для прямих запитів.
--
-- Доступ: лише власник; anon — нічого (revoke на таблиці й функції).
-- Безпечно для коду на проді: лише нові таблиці й функції.
--
-- Відкат:
--   drop function if exists public.album_sync_spreads(uuid, uuid[]);
--   drop function if exists public.album_save_spread(jsonb);
--   drop table if exists public.album_slots;
--   drop table if exists public.album_spreads;

-- ---------------------------------------------------------------------------
-- album_spreads
-- ---------------------------------------------------------------------------
create table if not exists public.album_spreads (
  -- Генерує браузер (crypto.randomUUID), щоб автозбереження було upsert-ом
  -- без зайвого кола до сервера.
  id          uuid primary key,
  project_id  uuid not null references public.album_projects (id) on delete cascade,
  owner_id    uuid not null references public.profiles (user_id) on delete cascade,
  position    integer not null default 0 check (position >= 0),
  kind        text not null default 'spread' check (kind in ('cover', 'spread')),
  layout      text not null default 'blank' check (char_length(layout) between 1 and 120),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists album_spreads_project_idx
  on public.album_spreads (project_id, position);

alter table public.album_spreads enable row level security;

drop policy if exists "album_spreads: owner all" on public.album_spreads;
create policy "album_spreads: owner all"
  on public.album_spreads for all to authenticated
  using (auth.uid() = owner_id)
  with check (
    auth.uid() = owner_id
    and exists (
      select 1 from public.album_projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

revoke all on public.album_spreads from anon;

drop trigger if exists album_spreads_touch on public.album_spreads;
create trigger album_spreads_touch
  before update on public.album_spreads
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- album_slots
-- ---------------------------------------------------------------------------
create table if not exists public.album_slots (
  id          uuid primary key default gen_random_uuid(),
  spread_id   uuid not null references public.album_spreads (id) on delete cascade,
  owner_id    uuid not null references public.profiles (user_id) on delete cascade,
  position    smallint not null default 0 check (position >= 0),
  x_mm        numeric(7, 2) not null,
  y_mm        numeric(7, 2) not null,
  w_mm        numeric(7, 2) not null check (w_mm > 0),
  h_mm        numeric(7, 2) not null check (h_mm > 0),
  -- Видалили фото з галереї — слот стає порожнім, макет не ламається.
  asset_id    uuid references public.assets (id) on delete set null,
  zoom        numeric(5, 3) not null default 1 check (zoom between 1 and 10),
  focal_x     numeric(5, 4) not null default 0.5 check (focal_x between 0 and 1),
  focal_y     numeric(5, 4) not null default 0.5 check (focal_y between 0 and 1)
);

create index if not exists album_slots_spread_idx on public.album_slots (spread_id, position);
create index if not exists album_slots_asset_idx on public.album_slots (asset_id);

alter table public.album_slots enable row level security;

drop policy if exists "album_slots: owner all" on public.album_slots;
create policy "album_slots: owner all"
  on public.album_slots for all to authenticated
  using (auth.uid() = owner_id)
  with check (
    auth.uid() = owner_id
    and exists (
      select 1 from public.album_spreads s
      where s.id = spread_id and s.owner_id = auth.uid()
    )
    -- Лише власні фото: інакше в чужий альбом можна було б підставити id
    -- чужого кадру і потім попросити на нього посилання для експорту.
    and (asset_id is null or exists (
      select 1 from public.assets a where a.id = asset_id and a.owner_id = auth.uid()
    ))
  );

revoke all on public.album_slots from anon;

-- ---------------------------------------------------------------------------
-- album_save_spread(p_spread jsonb)
--   {id, project_id, position, kind, layout,
--    slots: [{position, x_mm, y_mm, w_mm, h_mm, asset_id, zoom, focal_x, focal_y}]}
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

  insert into public.album_spreads as s (id, project_id, owner_id, position, kind, layout)
  values (
    v_id,
    v_project,
    v_uid,
    greatest(coalesce((p_spread ->> 'position')::int, 0), 0),
    coalesce(p_spread ->> 'kind', 'spread'),
    coalesce(nullif(p_spread ->> 'layout', ''), 'blank')
  )
  on conflict (id) do update
    set position = excluded.position,
        kind     = excluded.kind,
        layout   = excluded.layout
    -- Не переносимо чужий/інший розворот: id має належати тому ж проєкту.
    where s.owner_id = v_uid and s.project_id = v_project;

  if not found then
    raise exception 'spread_not_found' using errcode = '42501';
  end if;

  delete from public.album_slots where spread_id = v_id;

  insert into public.album_slots
    (spread_id, owner_id, position, x_mm, y_mm, w_mm, h_mm, asset_id, zoom, focal_x, focal_y)
  select v_id, v_uid, r.position, r.x_mm, r.y_mm, r.w_mm, r.h_mm, r.asset_id,
         coalesce(r.zoom, 1), coalesce(r.focal_x, 0.5), coalesce(r.focal_y, 0.5)
  from jsonb_to_recordset(v_slots) as r(
    position smallint, x_mm numeric, y_mm numeric, w_mm numeric, h_mm numeric,
    asset_id uuid, zoom numeric, focal_x numeric, focal_y numeric
  );

  update public.album_projects set updated_at = now() where id = v_project;
end;
$$;

-- ---------------------------------------------------------------------------
-- album_sync_spreads(p_project, p_ids) — порядок розворотів; яких немає в
-- списку, ті видаляються (разом зі слотами).
-- ---------------------------------------------------------------------------
create or replace function public.album_sync_spreads(p_project uuid, p_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  delete from public.album_spreads
  where project_id = p_project and not (id = any (coalesce(p_ids, '{}')));

  update public.album_spreads s
  set position = o.ord - 1
  from unnest(coalesce(p_ids, '{}')) with ordinality as o(id, ord)
  where s.id = o.id and s.project_id = p_project and s.position is distinct from o.ord - 1;

  update public.album_projects set updated_at = now() where id = p_project;
end;
$$;

revoke all on function public.album_save_spread(jsonb) from public, anon;
revoke all on function public.album_sync_spreads(uuid, uuid[]) from public, anon;
grant execute on function public.album_save_spread(jsonb) to authenticated;
grant execute on function public.album_sync_spreads(uuid, uuid[]) to authenticated;
