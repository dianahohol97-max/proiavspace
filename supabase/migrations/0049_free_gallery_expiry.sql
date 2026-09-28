-- Free plan: a gallery lives 30 days (decision 28.09.2026, launch week).
--
--   created on Free           → galleries.free_expires_at = created + 30 d
--   daily cron 03:00 UTC      → e-mails 7 d / 1 d before; past the date the
--                               gallery is marked free_expired_at and hidden
--                               from clients («галерея закрита, зверніться до
--                               фотографа»); the photographer still sees it
--   expired + 7 d             → files deleted (free_purged_at)
--   a paid plan (payment, promo, partner period) clears the deadline on all
--   of the owner's galleries.
--
-- Not the same as galleries.expires_at: that one is the photographer's own
-- «доступ до» date and stays untouched. Rules: src/lib/free-expiry.ts; cron:
-- /api/cron/free-expiry. The existing galleries get their 30 days in 0050.

alter table public.galleries
  add column if not exists free_expires_at timestamptz,
  add column if not exists free_expired_at timestamptz,
  add column if not exists free_purged_at timestamptz;

create index if not exists galleries_free_expiry_idx
  on public.galleries (free_expires_at)
  where free_expires_at is not null and free_purged_at is null;

-- Readable like the other gallery columns (0021 grants select per column).
grant select (free_expires_at, free_expired_at, free_purged_at)
  on public.galleries to anon, authenticated;

-- Paying (or in grace, promo, partner period) right now.
create or replace function public.owner_has_paid_plan(p_owner uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((
    select plan <> 'free' and (grace_until is null or grace_until > now())
      from public.profiles where user_id = p_owner
  ), false);
$$;
revoke execute on function public.owner_has_paid_plan(uuid) from public;
grant execute on function public.owner_has_paid_plan(uuid) to authenticated, service_role;

-- The deadline is the server's: set on insert, never by the user's own
-- client (authenticated holds table-wide INSERT/UPDATE on galleries).
-- SECURITY DEFINER functions and the service role run as other roles and
-- keep write access.
create or replace function public.galleries_free_expiry_guard()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if current_user in ('anon', 'authenticated') then
      new.free_expired_at := null;
      new.free_purged_at := null;
      new.free_expires_at := null;
    end if;
    if new.free_expires_at is null and not public.owner_has_paid_plan(new.owner_id) then
      new.free_expires_at := now() + interval '30 days';
    end if;
  elsif current_user in ('anon', 'authenticated') then
    new.free_expires_at := old.free_expires_at;
    new.free_expired_at := old.free_expired_at;
    new.free_purged_at := old.free_purged_at;
  end if;
  return new;
end;
$$;

drop trigger if exists galleries_free_expiry_guard on public.galleries;
create trigger galleries_free_expiry_guard
  before insert or update on public.galleries
  for each row execute function public.galleries_free_expiry_guard();

-- A paid plan lifts the deadline from every gallery of the owner, including
-- ones already closed (their files are still there for 7 days).
create or replace function public.profiles_clear_free_expiry()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.plan <> 'free' and (new.grace_until is null or new.grace_until > now()) then
    update public.galleries
       set free_expires_at = null, free_expired_at = null
     where owner_id = new.user_id
       and (free_expires_at is not null or free_expired_at is not null);
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_clear_free_expiry on public.profiles;
create trigger profiles_clear_free_expiry
  after update of plan, grace_until on public.profiles
  for each row execute function public.profiles_clear_free_expiry();

-- ---------------------------------------------------------------------------
-- Closure as clients see it (same places 0048 checks for a closed account)
-- ---------------------------------------------------------------------------
drop policy if exists "galleries: public read when published" on public.galleries;
create policy "galleries: public read when published"
  on public.galleries for select
  using (
    is_published
    and (expires_at is null or expires_at > now())
    and free_expired_at is null
    and not public.owner_galleries_closed(owner_id)
  );

create or replace function public.gallery_is_public(gid uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.galleries g
    where g.id = gid
      and g.is_published
      and (g.expires_at is null or g.expires_at > now())
      and g.free_expired_at is null
      and not public.owner_galleries_closed(g.owner_id)
  );
$$;

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
      and g.free_expired_at is null
      and not public.owner_galleries_closed(g.owner_id)
  );
$$;

-- 'expired' → «Галерею закрито. Зверніться до фотографа» on the public page.
create or replace function public.public_gallery_state(p_slug text)
returns text
language sql stable security definer set search_path = public
as $$
  select case
    when g.id is null then 'missing'
    when public.owner_galleries_closed(g.owner_id) then 'closed'
    when g.free_expired_at is not null then 'expired'
    else 'open'
  end
  from (select 1) one
  left join public.galleries g
    on g.slug = p_slug
   and g.is_published
   and (g.expires_at is null or g.expires_at > now());
$$;
revoke execute on function public.public_gallery_state(text) from public;
grant execute on function public.public_gallery_state(text) to anon, authenticated, service_role;

-- Client selections go through this SECURITY DEFINER function, which does its
-- own visibility check (0017, unchanged otherwise) — closed galleries (Free
-- deadline or a closed account, 0048) take no new picks either.
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

  -- The asset must actually belong to this gallery.
  if not exists (
    select 1 from public.assets a where a.id = p_asset and a.gallery_id = v_gallery
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

-- ---------------------------------------------------------------------------
-- Cron side (service role only)
-- ---------------------------------------------------------------------------

-- One row per warning e-mail per gallery and deadline (cycle = the
-- free_expires_at the letter was about; a new deadline starts fresh).
create table if not exists public.free_expiry_notices (
  gallery_id uuid not null references public.galleries (id) on delete cascade,
  cycle      timestamptz not null,
  kind       text not null check (kind in ('d7', 'd1')),
  sent_at    timestamptz not null default now(),
  primary key (gallery_id, cycle, kind)
);
alter table public.free_expiry_notices enable row level security;
-- No policies: service role only.

-- Galleries with a running or past deadline whose files still exist, with
-- what the cron needs to decide (asset count; the owner's plan state).
create or replace function public.free_expiry_candidates()
returns table (
  gallery_id uuid,
  owner_id uuid,
  title text,
  free_expires_at timestamptz,
  free_expired_at timestamptz,
  asset_count bigint,
  owner_paid boolean
)
language sql stable security definer set search_path = public
as $$
  select g.id, g.owner_id, g.title, g.free_expires_at, g.free_expired_at,
         (select count(*) from public.assets a where a.gallery_id = g.id),
         public.owner_has_paid_plan(g.owner_id)
    from public.galleries g
   where g.free_expires_at is not null
     and g.free_purged_at is null;
$$;
revoke execute on function public.free_expiry_candidates() from public, anon, authenticated;
grant execute on function public.free_expiry_candidates() to service_role;

-- Deletes the gallery's media rows (the accounting trigger frees the quota)
-- once it has been closed for p_days; refuses when the owner pays again or
-- the gallery is no longer closed. Returns the storage keys to remove — the
-- cron deletes them from B2 afterwards (anything it misses is an orphan the
-- storage-cleanup cron removes a day later).
create or replace function public.purge_free_gallery(p_gallery uuid, p_days int)
returns text[]
language plpgsql security definer set search_path = public
as $$
declare
  v_owner uuid;
  v_expired timestamptz;
  v_keys text[];
begin
  select owner_id, free_expired_at into v_owner, v_expired
    from public.galleries
   where id = p_gallery and free_purged_at is null
   for update;
  if v_owner is null
     or v_expired is null
     or v_expired + make_interval(days => p_days) > now()
     or public.owner_has_paid_plan(v_owner) then
    return null;
  end if;

  select coalesce(array_agg(k), '{}') into v_keys
    from (
      select a.r2_key as k from public.assets a where a.gallery_id = p_gallery
      union all
      select v.value from public.assets a, jsonb_each_text(coalesce(a.variants, '{}'::jsonb)) v
       where a.gallery_id = p_gallery
    ) keys;

  update public.galleries set cover_asset_id = null where id = p_gallery;
  delete from public.assets where gallery_id = p_gallery;
  update public.galleries set free_purged_at = now() where id = p_gallery;
  return v_keys;
end;
$$;
revoke execute on function public.purge_free_gallery(uuid, int) from public, anon, authenticated;
grant execute on function public.purge_free_gallery(uuid, int) to service_role;
