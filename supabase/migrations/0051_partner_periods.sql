-- Partner accounts: photographers we work with (Instagram, a case study,
-- feedback) get a paid plan for a set period without paying (decision
-- 28.09.2026, launch week).
--
--   admin sets plan (default Плюс), start, end, note   → /dashboard/stats/account/<id>
--   start ≤ now < end    profile carries the plan: plan = partner plan,
--                        grace_until = end (every limit/feature check and the
--                        quota trigger already read these two columns)
--   end − 7 d            e-mail «партнерський період закінчується…» (cron)
--   end                  back to Free (3 GB); existing galleries get 30 more
--                        days (free_expires_at = end + 30 d), new ones the usual
--                        30 days of 0049
--   a payment during the period ends it (the paid plan takes over).
--
-- The daily cron /api/cron/free-expiry calls apply_partner_period for every
-- open period; the admin action calls it right after saving.

create table if not exists public.partner_periods (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  plan             text not null default 'plus' check (plan in ('basic', 'plus', 'pro')),
  starts_at        timestamptz not null,
  ends_at          timestamptz not null,
  note             text,
  created_by       text,
  created_at       timestamptz not null default now(),
  -- the plan was put on the profile (first time the period was active)
  applied_at       timestamptz,
  -- the «закінчується через 7 днів» letter went out
  ending_notice_at timestamptz,
  -- closed: 'ended' (back to Free), 'paid' (a payment took over), 'revoked'
  finished_at      timestamptz,
  finish_reason    text check (finish_reason in ('ended', 'paid', 'revoked')),
  constraint partner_periods_dates check (ends_at > starts_at)
);
-- At most one open period per account.
create unique index if not exists partner_periods_one_open
  on public.partner_periods (user_id) where finished_at is null;
alter table public.partner_periods enable row level security;
-- No policies: the admin page and the cron use the service role. The
-- photographer reads only their own end date, via my_partner_until().

-- Storage per gallery plan in bytes — must match src/lib/plans.ts
-- (tests/lifecycle/partners.test.ts compares them).
create or replace function public.plan_storage_bytes(p_plan text)
returns bigint
language sql immutable
as $$
  select case p_plan
    when 'basic' then 107374182400   -- 100 GB
    when 'plus'  then 536870912000   -- 500 GB
    when 'pro'   then 1099511627776  -- 1 TB
    else 3221225472                  -- Free, 3 GB
  end::bigint;
$$;

-- Brings the profile in line with the account's open partner period.
-- Returns 'none' | 'scheduled' | 'active' | 'ended' | 'paid'.
create or replace function public.apply_partner_period(p_user uuid)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v public.partner_periods%rowtype;
  v_profile public.profiles%rowtype;
begin
  select * into v from public.partner_periods
   where user_id = p_user and finished_at is null
   for update;
  if not found then
    return 'none';
  end if;

  -- An auto-renewing paid plan wins: the period has nothing to add.
  if exists (
    select 1 from public.billing_subscriptions
     where user_id = p_user and product = 'gallery' and status = 'active'
  ) then
    update public.partner_periods set finished_at = now(), finish_reason = 'paid' where id = v.id;
    return 'paid';
  end if;

  if now() < v.starts_at then
    return 'scheduled';
  end if;

  select * into v_profile from public.profiles where user_id = p_user for update;

  if now() < v.ends_at then
    update public.profiles
       set plan = v.plan,
           storage_limit_bytes = public.plan_storage_bytes(v.plan),
           grace_until = v.ends_at,
           gallery_closed_at = null
     where user_id = p_user;
    update public.partner_periods set applied_at = coalesce(applied_at, now()) where id = v.id;
    return 'active';
  end if;

  -- Ended. Only undo what the period itself put on the profile. A payment
  -- in the meantime already closed the period (webhook → 'paid'), so reaching
  -- this point means the plan on the profile is still the partner's — unless
  -- the admin switched the account to something else by hand.
  if v.applied_at is not null
     and v_profile.plan = v.plan
     and not coalesce(v_profile.is_ambassador, false) then
    update public.profiles
       set plan = 'free',
           storage_limit_bytes = public.plan_storage_bytes('free'),
           grace_until = null
     where user_id = p_user;
    -- Existing galleries: 30 more days from the end of the period.
    update public.galleries
       set free_expires_at = greatest(v.ends_at, now()) + interval '30 days'
     where owner_id = p_user
       and free_expires_at is null
       and free_purged_at is null;
  end if;
  update public.partner_periods set finished_at = now(), finish_reason = 'ended' where id = v.id;
  return 'ended';
end;
$$;
revoke execute on function public.apply_partner_period(uuid) from public, anon, authenticated;
grant execute on function public.apply_partner_period(uuid) to service_role;

-- «Партнер до DD.MM» in the dashboard: the caller's own running period.
create or replace function public.my_partner_until()
returns timestamptz
language sql stable security definer set search_path = public
as $$
  select ends_at from public.partner_periods
   where user_id = auth.uid()
     and finished_at is null
     and applied_at is not null
     and ends_at > now();
$$;
revoke execute on function public.my_partner_until() from public, anon;
grant execute on function public.my_partner_until() to authenticated;
