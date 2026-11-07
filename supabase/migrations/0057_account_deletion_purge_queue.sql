-- 0057 · [LC-02] ключі файлів видаленого акаунта лишаються в черзі на
--        видалення з B2
--
-- Навіщо: видалення користувача в Supabase Auth каскадом прибирає profiles →
-- galleries → assets, portfolio_assets. Разом із рядками зникають r2_key, а
-- самі об'єкти в B2 лишаються назавжди (платимо за сховище, а дані людини,
-- яка попросила її видалити, фізично живі).
--
-- Що робимо: перед видаленням профілю тригер кладе в чергу
-- public.storage_purge_queue:
--   * кожен ключ оригіналу й варіантів з assets і portfolio_assets
--     (kind = 'object');
--   * префікс 'u/<user_id>/' (kind = 'prefix') — усе, що лежить під акаунтом
--     і не має рядка в БД: лого, social-відео, недокачані multipart, сироти.
-- Рядок черги не має FK на користувача — переживає видалення.
-- Черга тільки для service role (RLS увімкнено, політик немає).
-- Обробник (крон, що робить list/delete у B2 і ставить purged_at) — окрема
-- задача в коді; до нього черга просто накопичує ключі, нічого не ламає.
-- Звичайні видалення фото/галерей тригер не чіпає — лише видалення профілю
-- (а профіль видаляється тільки разом з акаунтом у Auth).
--
-- Відкат (черга з ключами пропаде — спершу обробити або вивантажити її):
--   drop trigger if exists profiles_enqueue_storage_purge on public.profiles;
--   drop function if exists public.enqueue_account_storage_purge();
--   drop table if exists public.storage_purge_queue;

create table if not exists public.storage_purge_queue (
  id          bigint generated always as identity primary key,
  -- B2 key (kind = 'object') or key prefix ending in '/' (kind = 'prefix').
  key         text not null,
  kind        text not null default 'object' check (kind in ('object', 'prefix')),
  -- Deleted account; plain uuid, no FK — the account is already gone.
  owner_id    uuid,
  reason      text not null default 'account_deleted',
  enqueued_at timestamptz not null default now(),
  -- Set by the worker once the object (or every object under the prefix) is
  -- gone from B2.
  purged_at   timestamptz,
  attempts    int not null default 0,
  last_error  text
);

create unique index if not exists storage_purge_queue_pending_key
  on public.storage_purge_queue (key) where purged_at is null;
create index if not exists storage_purge_queue_pending_idx
  on public.storage_purge_queue (enqueued_at) where purged_at is null;

alter table public.storage_purge_queue enable row level security;
-- No policies: service role only.
revoke all on public.storage_purge_queue from anon, authenticated;

create or replace function public.enqueue_account_storage_purge()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.storage_purge_queue (key, kind, owner_id)
  select k, 'object', old.user_id
    from (
      select a.r2_key as k from public.assets a where a.owner_id = old.user_id
      union
      select v.value from public.assets a, jsonb_each_text(coalesce(a.variants, '{}'::jsonb)) v
       where a.owner_id = old.user_id
      union
      select pa.r2_key from public.portfolio_assets pa where pa.owner_id = old.user_id
      union
      select v.value from public.portfolio_assets pa, jsonb_each_text(coalesce(pa.variants, '{}'::jsonb)) v
       where pa.owner_id = old.user_id
    ) keys
   where k is not null and k <> ''
  on conflict (key) where purged_at is null do nothing;

  insert into public.storage_purge_queue (key, kind, owner_id)
  values ('u/' || old.user_id || '/', 'prefix', old.user_id)
  on conflict (key) where purged_at is null do nothing;

  return old;
end;
$$;
revoke execute on function public.enqueue_account_storage_purge() from public, anon, authenticated;

-- BEFORE DELETE: the cascade to galleries/assets/portfolio_assets runs after
-- the profile row is deleted, so the keys are still readable here.
drop trigger if exists profiles_enqueue_storage_purge on public.profiles;
create trigger profiles_enqueue_storage_purge
  before delete on public.profiles
  for each row execute function public.enqueue_account_storage_purge();
