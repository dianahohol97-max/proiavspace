-- 0056 · [PR-01] слот «перших 30» не звільняється при видаленні акаунта
--
-- Навіщо: grant_import_promo рахує видані промо як count(*) з promo_grants,
-- а promo_grants.user_id мав `on delete cascade` від auth.users. Видалили
-- акаунт у Supabase Auth → рядок зник → слот звільнився → загалом можна
-- роздати понад 30 промо.
--
-- Що робимо: рядок промо переживає акаунт.
--   * новий первинний ключ id (user_id більше не може бути PK, бо стає NULL);
--   * user_id — nullable, unique (кілька NULL дозволено), FK `on delete set null`;
--   * user_deleted_at — коли акаунт видалили (заповнює тригер), для звітів.
-- grant_import_promo не змінюється: count(*) тепер рахує й «осиротілі» рядки,
-- а `where user_id = p_user` для живих акаунтів працює як раніше.
-- Код (renew, webhook, checkout, retention, billing) завжди фільтрує
-- .eq('user_id', …), тож рядки з NULL ніде не підхоплюються.
-- ON CONFLICT (user_id) ніде не використовується; унікальність лишається.
--
-- Відкат (УВАГА: видалить рядки промо видалених акаунтів — слоти знову
-- звільняться):
--   delete from public.promo_grants where user_id is null;
--   drop trigger if exists promo_grants_mark_user_deleted on public.promo_grants;
--   drop function if exists public.promo_grants_mark_user_deleted();
--   alter table public.promo_grants drop constraint promo_grants_user_id_fkey,
--     drop constraint promo_grants_pkey, drop constraint promo_grants_user_id_key;
--   alter table public.promo_grants drop column id, drop column user_deleted_at,
--     alter column user_id set not null, add primary key (user_id),
--     add constraint promo_grants_user_id_fkey foreign key (user_id)
--       references auth.users (id) on delete cascade;

alter table public.promo_grants
  add column if not exists id uuid not null default gen_random_uuid(),
  add column if not exists user_deleted_at timestamptz;

alter table public.promo_grants drop constraint if exists promo_grants_user_id_fkey;
alter table public.promo_grants drop constraint if exists promo_grants_pkey;
alter table public.promo_grants alter column user_id drop not null;
alter table public.promo_grants add constraint promo_grants_pkey primary key (id);
alter table public.promo_grants add constraint promo_grants_user_id_key unique (user_id);
alter table public.promo_grants
  add constraint promo_grants_user_id_fkey foreign key (user_id)
  references auth.users (id) on delete set null;

-- FK «set null» оновлює рядок як звичайний UPDATE — ловимо його тут.
create or replace function public.promo_grants_mark_user_deleted()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.user_id is not null and new.user_id is null then
    new.user_deleted_at := coalesce(new.user_deleted_at, now());
  end if;
  return new;
end;
$$;
revoke execute on function public.promo_grants_mark_user_deleted() from public, anon, authenticated;

drop trigger if exists promo_grants_mark_user_deleted on public.promo_grants;
create trigger promo_grants_mark_user_deleted
  before update of user_id on public.promo_grants
  for each row execute function public.promo_grants_mark_user_deleted();
