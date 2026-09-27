-- Plan lifecycle and storage retention (audit LC-01, decision 26.09.2026).
--
--   end of a paid plan / promo month
--     → 14 days of grace with full access          (grace_until = end + 14 d)
--     → galleries closed to clients                (profiles.gallery_closed_at)
--       the photographer still sees and downloads everything
--     → 60 days later the files are deleted from B2
--   e-mails: start of grace, closure, 30 / 7 / 1 day before deletion.
--   Free accounts (and lapsed accounts that fit into the Free allowance) have
--   no deadline — only the limit.
--
-- The cron /api/cron/storage-retention drives it (src/lib/retention.ts has the
-- rules). This migration only adds the state, the client-side closure, and
-- the 14-day grace for the import promo.

-- ---------------------------------------------------------------------------
-- State
-- ---------------------------------------------------------------------------

-- Set by the cron when the galleries are closed to clients (after the
-- closure e-mail went out). Deletion is due 60 days after this moment.
alter table public.profiles add column if not exists gallery_closed_at timestamptz;

-- One row per lifecycle e-mail per lapse. `cycle` is the grace_until of the
-- lapse, so paying and lapsing again starts a fresh set of notices.
create table if not exists public.lifecycle_notices (
  user_id  uuid not null references auth.users (id) on delete cascade,
  cycle    timestamptz not null,
  kind     text not null check (kind in (
             'grace_start', 'failed_charge', 'closed',
             'delete_30', 'delete_7', 'delete_1', 'deleted')),
  sent_at  timestamptz not null default now(),
  primary key (user_id, cycle, kind)
);
alter table public.lifecycle_notices enable row level security;
-- No policies: service role only.

-- E-mail of a user for server-side notifications (service role only), so the
-- crons don't call the GoTrue admin API per letter. Identical to the helper in
-- 0047 (referral e-mails, PR #170) — `create or replace`, so the order in which
-- the two migrations land does not matter.
create or replace function public.user_email(p_user uuid)
returns text
language sql stable security definer set search_path = public
as $$
  select email from auth.users where id = p_user;
$$;
revoke execute on function public.user_email(uuid) from public, anon, authenticated;
grant execute on function public.user_email(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Closure as clients see it
-- ---------------------------------------------------------------------------

-- Closed = the cron closed the galleries AND the account is not paying again.
-- A payment or a new promo (plan <> free with grace in the future, or an
-- auto-renewing plan) reopens instantly, before the cron tidies the column.
create or replace function public.owner_galleries_closed(p_owner uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((
    select gallery_closed_at is not null
       and not (plan <> 'free' and (grace_until is null or grace_until > now()))
      from public.profiles
     where user_id = p_owner
  ), false);
$$;
revoke execute on function public.owner_galleries_closed(uuid) from public;
grant execute on function public.owner_galleries_closed(uuid) to anon, authenticated, service_role;

-- Anonymous visitors no longer read galleries (and, through the assets
-- policy's subquery, their files) of a closed account. The owner policy is
-- untouched: the photographer keeps full access.
drop policy if exists "galleries: public read when published" on public.galleries;
create policy "galleries: public read when published"
  on public.galleries for select
  using (
    is_published
    and (expires_at is null or expires_at > now())
    and not public.owner_galleries_closed(owner_id)
  );

-- The child-table helpers are SECURITY DEFINER (they bypass the galleries
-- policy above), so they need the same check: assets of open galleries
-- (0042), selections, view/download/archive events (0001, 0002, 0017).
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
      and not public.owner_galleries_closed(g.owner_id)
  );
$$;

-- What the public gallery page shows for a slug: 'closed' → «галерея
-- тимчасово недоступна» in the visitor's language instead of «не знайдено».
create or replace function public.public_gallery_state(p_slug text)
returns text
language sql stable security definer set search_path = public
as $$
  select case
    when g.id is null then 'missing'
    when public.owner_galleries_closed(g.owner_id) then 'closed'
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

-- ---------------------------------------------------------------------------
-- Deletion (called by the cron AFTER the files are gone from B2)
-- ---------------------------------------------------------------------------

-- Drops the account's media rows (the accounting trigger zeroes the usage),
-- unpublishes the now-empty galleries and returns the account to plain Free.
-- Refuses unless the account is still closed and past its deletion date, so a
-- payment that lands between the B2 delete and this call keeps the rows.
create or replace function public.finish_retention_deletion(p_user uuid, p_retention_days int)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_closed timestamptz;
begin
  select gallery_closed_at into v_closed
    from public.profiles where user_id = p_user for update;
  if v_closed is null
     or not public.owner_galleries_closed(p_user)
     or v_closed + make_interval(days => p_retention_days) > now() then
    return false;
  end if;

  delete from public.assets where owner_id = p_user;
  delete from public.portfolio_assets where owner_id = p_user;
  update public.galleries set is_published = false where owner_id = p_user;
  update public.profiles
     set plan = 'free',
         storage_limit_bytes = 3221225472, -- Free, 3 GB (plans.ts)
         grace_until = null,
         gallery_closed_at = null
   where user_id = p_user;
  return true;
end;
$$;
revoke execute on function public.finish_retention_deletion(uuid, int) from public, anon, authenticated;
grant execute on function public.finish_retention_deletion(uuid, int) to service_role;

-- ---------------------------------------------------------------------------
-- Import promo: 14 days of grace after the free month, like any plan
-- ---------------------------------------------------------------------------
create or replace function public.grant_import_promo(
  p_user uuid,
  p_import_id uuid,
  p_storage_bytes bigint,
  p_max_grants int,
  p_deadline timestamptz
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ends timestamptz;
begin
  -- One promo "slot" counter for everyone: serialize grants so two imports
  -- finishing at the same moment can't both take the 30th slot.
  perform pg_advisory_xact_lock(hashtext('promo_grants:import_basic_month'));

  if now() >= p_deadline then
    return null;
  end if;
  if (select count(*) from public.promo_grants) >= p_max_grants then
    return null;
  end if;
  -- Once per account, forever (PR-02): payment history does not matter.
  if exists (select 1 from public.promo_grants where user_id = p_user) then
    return null;
  end if;

  -- A real, completed import of this user with at least one file.
  if not exists (
    select 1 from public.gallery_imports
     where id = p_import_id
       and owner_id = p_user
       and status = 'completed'
       and imported_count > 0
  ) then
    return null;
  end if;

  -- Paying customers keep their plan; the promo is for accounts on free
  -- (including a paid plan whose grace period is already over).
  if exists (
    select 1 from public.billing_subscriptions
     where user_id = p_user and product = 'gallery' and status = 'active'
  ) then
    return null;
  end if;
  if exists (
    select 1 from public.profiles
     where user_id = p_user
       and plan <> 'free'
       and (grace_until is null or grace_until > now())
  ) then
    return null;
  end if;

  v_ends := now() + interval '1 month';

  insert into public.promo_grants (user_id, import_id, ends_at)
  values (p_user, p_import_id, v_ends);

  -- Full access for the month plus the same 14-day grace as a paid plan.
  update public.profiles
     set plan = 'basic',
         storage_limit_bytes = p_storage_bytes,
         grace_until = v_ends + interval '14 days',
         gallery_closed_at = null
   where user_id = p_user;

  return v_ends;
end;
$$;

revoke execute on function public.grant_import_promo(uuid, uuid, bigint, int, timestamptz)
  from public, anon, authenticated;
grant execute on function public.grant_import_promo(uuid, uuid, bigint, int, timestamptz)
  to service_role;

-- Running promos (granted with grace_until = ends_at, no auto-payment) get
-- the same 14 days.
update public.profiles p
   set grace_until = g.ends_at + interval '14 days'
  from public.promo_grants g
 where g.user_id = p.user_id
   and g.autopay_at is null
   and g.ends_at > now()
   and p.grace_until = g.ends_at;
