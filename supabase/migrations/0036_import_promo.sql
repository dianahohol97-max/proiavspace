-- Promo «Імпортуй галерею — місяць Базового безкоштовно».
--
-- Granted automatically on the first completed zip import (0035) that brought
-- in at least one file, once per account, to accounts on the free plan, while
-- fewer than N grants exist and before the deadline (both passed in by the
-- server from src/lib/promo.ts, so the rules live in one place).
--
-- The grant itself is ordinary billing state: plan = basic with grace_until =
-- end of the promo month, so the account falls back to free lazily through
-- the same effectiveGalleryPlan() rule as any expired plan — unless the
-- photographer connects auto-payment during the month (payments.purpose).

create table if not exists public.promo_grants (
  user_id           uuid primary key references auth.users (id) on delete cascade,
  promo             text not null default 'import_basic_month',
  import_id         uuid references public.gallery_imports (id) on delete set null,
  granted_at        timestamptz not null default now(),
  ends_at           timestamptz not null,
  -- Auto-payment connected in the promo month (first month paid upfront).
  autopay_at        timestamptz,
  -- «Промо закінчується за 7 днів» email sent (by the renewal cron).
  reminder_sent_at  timestamptz
);

alter table public.promo_grants enable row level security;

-- The photographer can see their own grant (billing page, import report);
-- nobody but the service role writes.
create policy "promo_grants: owner select"
  on public.promo_grants for select
  using (auth.uid() = user_id);

-- Marks the checkout that connects auto-payment during the promo month, so
-- the webhook starts the paid period after the promo instead of today.
alter table public.payments
  add column if not exists purpose text;

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

  update public.profiles
     set plan = 'basic',
         storage_limit_bytes = p_storage_bytes,
         grace_until = v_ends
   where user_id = p_user;

  return v_ends;
end;
$$;

revoke execute on function public.grant_import_promo(uuid, uuid, bigint, int, timestamptz)
  from public, anon, authenticated;
grant execute on function public.grant_import_promo(uuid, uuid, bigint, int, timestamptz)
  to service_role;
