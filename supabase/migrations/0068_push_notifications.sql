-- 0068 · Сповіщення застосунку фотографа (Web Push) — feat/photographer-app → release/4
--
-- Навіщо: кабінет, встановлений на телефон (PWA), надсилає фотографу
-- сповіщення: клієнт обрав фото / позначив ретуш, галерею вперше
-- переглянули, нова заявка, місце в сховищі закінчується, галерея скоро
-- закриється. Кожен тип фотограф вмикає окремо.
--
--   push_subscriptions(id, owner_id, endpoint, p256dh, auth, locale,
--                      user_agent, created_at, last_success_at)
--     одна підписка браузера/телефона; endpoint унікальний (той самий
--     телефон, інший акаунт → сервер переносить підписку, див. API).
--   push_preferences(owner_id PK, client_picks, first_view, booking,
--                    storage_low, gallery_expiring, updated_at)
--     рядка немає → усі типи увімкнені (так вирішує код).
--   push_deliveries(owner_id, kind, dedupe_key, sent_at)
--     журнал «уже надіслано», щоб одна подія не прийшла двічі; пише й
--     читає лише сервер (service role).
--
-- Безпека: RLS. Підписки й налаштування — лише власнику (owner_id =
-- auth.uid()). Журнал — нікому, крім service role. Анонімам — нічого.
-- Акаунт видаляється — рядки йдуть каскадом.
--
-- Безпечна для коду на проді: лише нові таблиці. Код без цієї міграції
-- працює: блок «Сповіщення» в налаштуваннях каже, що потрібне оновлення
-- бази, а сервер тихо нічого не надсилає.
--
-- Відкат:
--   drop table if exists public.push_deliveries;
--   drop table if exists public.push_preferences;
--   drop table if exists public.push_subscriptions;

create table if not exists public.push_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references public.profiles (user_id) on delete cascade,
  endpoint        text not null unique
                  check (char_length(endpoint) between 20 and 1000 and endpoint like 'https://%'),
  p256dh          text not null check (char_length(p256dh) between 20 and 200),
  auth            text not null check (char_length(auth) between 8 and 100),
  locale          text not null default 'uk' check (char_length(locale) between 2 and 5),
  user_agent      text check (user_agent is null or char_length(user_agent) <= 300),
  created_at      timestamptz not null default now(),
  last_success_at timestamptz
);

create index if not exists push_subscriptions_owner_idx on public.push_subscriptions (owner_id);

alter table public.push_subscriptions enable row level security;

revoke all on public.push_subscriptions from anon;
revoke all on public.push_subscriptions from authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

drop policy if exists "push_subscriptions: owner select" on public.push_subscriptions;
create policy "push_subscriptions: owner select" on public.push_subscriptions
  for select to authenticated using (owner_id = auth.uid());

drop policy if exists "push_subscriptions: owner insert" on public.push_subscriptions;
create policy "push_subscriptions: owner insert" on public.push_subscriptions
  for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists "push_subscriptions: owner update" on public.push_subscriptions;
create policy "push_subscriptions: owner update" on public.push_subscriptions
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "push_subscriptions: owner delete" on public.push_subscriptions;
create policy "push_subscriptions: owner delete" on public.push_subscriptions
  for delete to authenticated using (owner_id = auth.uid());


create table if not exists public.push_preferences (
  owner_id         uuid primary key references public.profiles (user_id) on delete cascade,
  client_picks     boolean not null default true,
  first_view       boolean not null default true,
  booking          boolean not null default true,
  storage_low      boolean not null default true,
  gallery_expiring boolean not null default true,
  updated_at       timestamptz not null default now()
);

drop trigger if exists push_preferences_touch_updated_at on public.push_preferences;
create trigger push_preferences_touch_updated_at
  before update on public.push_preferences
  for each row execute function public.touch_updated_at();

alter table public.push_preferences enable row level security;

revoke all on public.push_preferences from anon;
revoke all on public.push_preferences from authenticated;
grant select, insert, update on public.push_preferences to authenticated;

drop policy if exists "push_preferences: owner select" on public.push_preferences;
create policy "push_preferences: owner select" on public.push_preferences
  for select to authenticated using (owner_id = auth.uid());

drop policy if exists "push_preferences: owner insert" on public.push_preferences;
create policy "push_preferences: owner insert" on public.push_preferences
  for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists "push_preferences: owner update" on public.push_preferences;
create policy "push_preferences: owner update" on public.push_preferences
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());


create table if not exists public.push_deliveries (
  owner_id   uuid not null references public.profiles (user_id) on delete cascade,
  kind       text not null check (kind in ('client_picks', 'first_view', 'booking', 'storage_low', 'gallery_expiring')),
  dedupe_key text not null check (char_length(dedupe_key) between 1 and 200),
  sent_at    timestamptz not null default now(),
  primary key (owner_id, kind, dedupe_key)
);

create index if not exists push_deliveries_sent_idx on public.push_deliveries (sent_at);

alter table public.push_deliveries enable row level security;
-- Без політик і без прав: лише service role (сервер).
revoke all on public.push_deliveries from anon;
revoke all on public.push_deliveries from authenticated;

-- Галереї, які вже хтось відкривав до цієї міграції, не повинні після
-- деплою прислати «вперше переглянули».
insert into public.push_deliveries (owner_id, kind, dedupe_key)
select owner_id, 'first_view', 'gallery:' || id
from public.galleries
where view_count > 0
on conflict do nothing;
