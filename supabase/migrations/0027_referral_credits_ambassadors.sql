-- Referral model v2: recurring credit for regular photographers, cash for
-- ambassadors.
--   • A regular referrer earns 10% of EVERY payment their referred photographers
--     make, as проЯв credit (credit_balance_kop) that reduces their next invoice.
--   • An ambassador (admin-assigned) gets their own plans free and earns the same
--     10% as CASH (cash_balance_kop), withdrawable from 200 ₴.
-- Balances are stored in kopecks (integer) to avoid floating-point money.

alter table public.profiles add column if not exists is_ambassador boolean not null default false;
alter table public.profiles add column if not exists credit_balance_kop integer not null default 0;
alter table public.profiles add column if not exists cash_balance_kop integer not null default 0;

-- Immutable log of every accrual (audit + the referrer's dashboard history).
create table if not exists public.referral_earnings (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users (id),
  referred_id uuid not null references auth.users (id),
  payment_id uuid,
  amount_kop integer not null,
  kind text not null check (kind in ('credit', 'cash')),
  created_at timestamptz not null default now()
);
alter table public.referral_earnings enable row level security;
create index if not exists referral_earnings_referrer_idx
  on public.referral_earnings (referrer_id, created_at desc);
create policy "referral_earnings: own select"
  on public.referral_earnings for select
  using (referrer_id = auth.uid());

-- Cash-out requests. Processed manually by an admin (no automated card payouts).
create table if not exists public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  amount_kop integer not null,
  details text not null default '',
  status text not null default 'requested' check (status in ('requested', 'paid', 'rejected')),
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
alter table public.withdrawals enable row level security;
create index if not exists withdrawals_user_idx on public.withdrawals (user_id, created_at desc);
create policy "withdrawals: own select"
  on public.withdrawals for select
  using (user_id = auth.uid());

-- Dashboard stats: a user only ever sees their own (auth.uid()).
drop function if exists public.get_referral_stats();
create function public.get_referral_stats()
returns table (
  invited int,
  converted int,
  credit_kop int,
  cash_kop int,
  is_ambassador boolean
)
language sql security definer set search_path = public stable
as $$
  select
    (select count(*)::int from public.referrals where referrer_id = auth.uid()),
    (select count(*)::int from public.referrals where referrer_id = auth.uid() and status = 'converted'),
    (select coalesce(credit_balance_kop, 0) from public.profiles where user_id = auth.uid()),
    (select coalesce(cash_balance_kop, 0) from public.profiles where user_id = auth.uid()),
    (select coalesce(is_ambassador, false) from public.profiles where user_id = auth.uid());
$$;
revoke execute on function public.get_referral_stats() from public, anon;
grant execute on function public.get_referral_stats() to authenticated;

-- Ambassador cash-out: only ambassadors, only >= 200 ₴, only up to the balance.
-- Atomically zeroes the cash balance into a 'requested' withdrawal row.
create or replace function public.request_withdrawal(p_details text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_amb boolean;
  v_cash int;
  v_id uuid;
begin
  select is_ambassador, coalesce(cash_balance_kop, 0)
    into v_amb, v_cash
  from public.profiles
  where user_id = auth.uid()
  for update;

  if not coalesce(v_amb, false) then
    raise exception 'not_ambassador';
  end if;
  if v_cash < 20000 then
    raise exception 'below_minimum';
  end if;

  update public.profiles set cash_balance_kop = 0 where user_id = auth.uid();
  insert into public.withdrawals (user_id, amount_kop, details)
  values (auth.uid(), v_cash, coalesce(p_details, ''))
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.request_withdrawal(text) from public, anon;
grant execute on function public.request_withdrawal(text) to authenticated;

-- Credit redeemed against a specific checkout, so the webhook can deduct it
-- from the referrer/user's balance exactly once when that payment succeeds.
alter table public.payments add column if not exists credit_applied_kop integer not null default 0;
