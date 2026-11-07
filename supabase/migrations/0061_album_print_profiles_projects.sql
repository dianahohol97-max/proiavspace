-- 0061 · Конструктор альбомів, етап 1: профілі друку і проєкти альбомів
--
-- Навіщо: фотограф верстає весільний/сімейний альбом онлайн із фото своєї
-- галереї. Профіль друку — його власні налаштування друкарні (формат
-- розвороту, виліт, безпечне поле, DPI, колірний профіль, окремий формат
-- обкладинки). Проєкт — один альбом; при створенні в нього копіюється
-- знімок профілю (spec), щоб правка профілю потім не зсувала вже зверстані
-- слоти. Розвороти й слоти — у 0062.
--
-- Доступ: лише власник (auth.uid() = owner_id), для anon таблиці закриті
-- повністю (revoke + жодної політики). Готові профілі-приклади живуть у коді
-- (src/lib/album/profiles.ts), а не в БД: «скопіювати приклад» = insert
-- власного рядка.
--
-- Безпечно для коду на проді: лише нові таблиці, нічого чинного не змінено.
--
-- Відкат (разом з 0062; спершу відкотити 0062):
--   drop table if exists public.album_projects;
--   drop table if exists public.album_print_profiles;

-- ---------------------------------------------------------------------------
-- album_print_profiles
-- ---------------------------------------------------------------------------
create table if not exists public.album_print_profiles (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null references public.profiles (user_id) on delete cascade,
  name              text not null check (char_length(name) between 1 and 80),
  -- Розворот (обидві сторінки разом) у мм, без вильоту.
  spread_width_mm   numeric(6, 1) not null check (spread_width_mm between 50 and 2000),
  spread_height_mm  numeric(6, 1) not null check (spread_height_mm between 50 and 1000),
  bleed_mm          numeric(4, 1) not null default 3 check (bleed_mm between 0 and 20),
  safe_mm           numeric(4, 1) not null default 5 check (safe_mm between 0 and 50),
  -- Поля і відступ між фото для шаблонів «з відступами».
  margin_mm         numeric(4, 1) not null default 10 check (margin_mm between 0 and 100),
  gap_mm            numeric(4, 1) not null default 4 check (gap_mm between 0 and 50),
  dpi               smallint not null default 300 check (dpi between 72 and 1200),
  -- Пишеться в метадані експорту (ICC); пікселі при Adobe RGB перераховуються.
  color_profile     text not null default 'srgb' check (color_profile in ('srgb', 'adobe_rgb')),
  -- Обкладинка окремо від блоку: свій розмір (повна розгортка з корінцем),
  -- свій виліт. null у cover_width_mm = обкладинка того ж формату, що блок.
  cover_width_mm    numeric(6, 1) check (cover_width_mm is null or cover_width_mm between 50 and 2000),
  cover_height_mm   numeric(6, 1) check (cover_height_mm is null or cover_height_mm between 50 and 1000),
  cover_bleed_mm    numeric(4, 1) not null default 15 check (cover_bleed_mm between 0 and 50),
  cover_spine_mm    numeric(4, 1) not null default 0 check (cover_spine_mm between 0 and 100),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint album_print_profiles_cover_pair
    check ((cover_width_mm is null) = (cover_height_mm is null))
);

create index if not exists album_print_profiles_owner_idx
  on public.album_print_profiles (owner_id, created_at);

alter table public.album_print_profiles enable row level security;

drop policy if exists "album_print_profiles: owner all" on public.album_print_profiles;
create policy "album_print_profiles: owner all"
  on public.album_print_profiles for all to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

revoke all on public.album_print_profiles from anon;

drop trigger if exists album_print_profiles_touch on public.album_print_profiles;
create trigger album_print_profiles_touch
  before update on public.album_print_profiles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- album_projects
-- ---------------------------------------------------------------------------
create table if not exists public.album_projects (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles (user_id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 120),
  -- Звідки профіль (для довідки); видалення профілю проєкт не ламає.
  profile_id  uuid references public.album_print_profiles (id) on delete set null,
  -- Галерея-джерело фото. Для «порожнього» проєкту застосунок створює
  -- неопубліковану галерею під завантаження (той самий конвеєр, квота,
  -- прев'ю). Видалили галерею — слоти лишаються порожніми (0062: set null).
  gallery_id  uuid references public.galleries (id) on delete set null,
  -- Знімок профілю друку на момент створення (src/lib/album/types.ts PrintSpec).
  spec        jsonb not null check (jsonb_typeof(spec) = 'object'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists album_projects_owner_idx
  on public.album_projects (owner_id, updated_at desc);
create index if not exists album_projects_gallery_idx
  on public.album_projects (gallery_id);

alter table public.album_projects enable row level security;

drop policy if exists "album_projects: owner all" on public.album_projects;
create policy "album_projects: owner all"
  on public.album_projects for all to authenticated
  using (auth.uid() = owner_id)
  with check (
    auth.uid() = owner_id
    -- Чужу галерею як джерело не підставити.
    and (gallery_id is null or exists (
      select 1 from public.galleries g where g.id = gallery_id and g.owner_id = auth.uid()
    ))
  );

revoke all on public.album_projects from anon;

drop trigger if exists album_projects_touch on public.album_projects;
create trigger album_projects_touch
  before update on public.album_projects
  for each row execute function public.touch_updated_at();
