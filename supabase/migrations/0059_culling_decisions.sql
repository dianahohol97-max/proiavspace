-- 0059 · Рішення AI-відбору кадрів у базі (release/7)
--
-- Навіщо: панель «Відібрати кадри» зберігає рішення фотографа лише в
-- IndexedDB браузера. З цією таблицею вони видно на всіх його пристроях.
-- Тут ЛИШЕ рішення людини, а не виміри (різкість, dHash, обличчя): виміри
-- браузер перераховує сам і кешує локально.
--
--   culling_decisions(asset_id PK, gallery_id, owner_id, decision,
--                     best_of_series, updated_at)
--     decision        'confirmed' — «так, це брак» (позначку залишено)
--                     'cleared'   — позначку прибрано, кадр нормальний
--                     null        — рішення немає (рядок тримає лише best_of_series)
--     best_of_series  ключ серії ('s:<id першого кадру>'), для якої фотограф
--                     сам обрав цей кадр кращим; null — не обирав
--
-- Безпека: RLS, усе — лише власнику галереї (owner_id = auth.uid() і кадр
-- справді лежить у його галереї). Анонімам — нічого: ні політик, ні прав.
-- Кадр/галерея/акаунт видаляються — рядки йдуть каскадом.
--
-- Безпечна для коду на проді: нова таблиця, нічого наявного не змінює.
-- Код release/7 без неї працює як раніше (IndexedDB): помилку «таблиці
-- немає» він тихо пропускає.
--
-- Відкат (код release/7 далі працює через IndexedDB):
--   drop table if exists public.culling_decisions;

create table if not exists public.culling_decisions (
  asset_id       uuid primary key references public.assets (id) on delete cascade,
  gallery_id     uuid not null references public.galleries (id) on delete cascade,
  owner_id       uuid not null references public.profiles (user_id) on delete cascade,
  decision       text check (decision in ('confirmed', 'cleared')),
  best_of_series text check (best_of_series is null or char_length(best_of_series) between 3 and 80),
  updated_at     timestamptz not null default now(),
  constraint culling_decisions_not_empty check (decision is not null or best_of_series is not null)
);

create index if not exists culling_decisions_gallery_idx on public.culling_decisions (gallery_id);

drop trigger if exists culling_decisions_touch_updated_at on public.culling_decisions;
create trigger culling_decisions_touch_updated_at
  before update on public.culling_decisions
  for each row execute function public.touch_updated_at();

alter table public.culling_decisions enable row level security;

-- Анонімам — нічого. Залогіненим — лише через політики нижче.
revoke all on public.culling_decisions from anon;
revoke all on public.culling_decisions from authenticated;
grant select, insert, update, delete on public.culling_decisions to authenticated;

drop policy if exists "culling_decisions: owner select" on public.culling_decisions;
create policy "culling_decisions: owner select" on public.culling_decisions
  for select to authenticated
  using (owner_id = auth.uid());

-- Писати можна лише про свій кадр у своїй галереї (gallery_id і owner_id
-- рядка мають збігатися з самим кадром).
drop policy if exists "culling_decisions: owner insert" on public.culling_decisions;
create policy "culling_decisions: owner insert" on public.culling_decisions
  for insert to authenticated
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.assets a
      where a.id = asset_id and a.gallery_id = culling_decisions.gallery_id and a.owner_id = auth.uid()
    )
  );

drop policy if exists "culling_decisions: owner update" on public.culling_decisions;
create policy "culling_decisions: owner update" on public.culling_decisions
  for update to authenticated
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.assets a
      where a.id = asset_id and a.gallery_id = culling_decisions.gallery_id and a.owner_id = auth.uid()
    )
  );

drop policy if exists "culling_decisions: owner delete" on public.culling_decisions;
create policy "culling_decisions: owner delete" on public.culling_decisions
  for delete to authenticated
  using (owner_id = auth.uid());
