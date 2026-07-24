-- Referral system: every photographer gets a share code; a referred photographer
-- who becomes paying earns both sides a free month (applied at their next renewal
-- via profiles.pending_free_months — no interactive-checkout surgery).

alter table public.profiles add column if not exists referral_code text;
update public.profiles
  set referral_code = lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  where referral_code is null;
alter table public.profiles
  alter column referral_code set default lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
create unique index if not exists profiles_referral_code_key on public.profiles (referral_code);
alter table public.profiles add column if not exists referred_by uuid references auth.users (id);
alter table public.profiles add column if not exists pending_free_months int not null default 0;

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users (id),
  referred_id uuid not null references auth.users (id) unique,
  status text not null default 'pending' check (status in ('pending', 'converted')),
  created_at timestamptz not null default now(),
  converted_at timestamptz
);
alter table public.referrals enable row level security;

-- Signup trigger captures ?ref= (a referral_code) → referred_by + a pending referral.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  ref_code text := new.raw_user_meta_data ->> 'ref';
  ref_user uuid;
begin
  if ref_code is not null and length(ref_code) > 0 then
    select user_id into ref_user from public.profiles where referral_code = ref_code;
  end if;
  if ref_user = new.id then
    ref_user := null;
  end if;

  insert into public.profiles (user_id, display_name, referred_by)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    ref_user
  );

  if ref_user is not null then
    insert into public.referrals (referrer_id, referred_id)
    values (ref_user, new.id)
    on conflict (referred_id) do nothing;
  end if;

  return new;
end;
$$;

-- Own referral stats for the dashboard (auth.uid() — a user only sees their own).
create or replace function public.get_referral_stats()
returns table (invited int, converted int, free_months int)
language sql security definer set search_path = public stable
as $$
  select
    (select count(*)::int from public.referrals where referrer_id = auth.uid()),
    (select count(*)::int from public.referrals where referrer_id = auth.uid() and status = 'converted'),
    (select coalesce(pending_free_months, 0) from public.profiles where user_id = auth.uid());
$$;
revoke execute on function public.get_referral_stats() from public, anon;
grant execute on function public.get_referral_stats() to authenticated;
