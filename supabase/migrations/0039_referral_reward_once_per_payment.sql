-- A referral reward is accrued at most once per payment.
--
-- The billing webhook claims the 'paid' transition atomically, but the DB is
-- the backstop: a unique payment_id on referral_earnings, and the accrual
-- writes the earnings row FIRST and only moves the balance when that insert
-- actually happened. A duplicate call is a silent no-op instead of a second
-- credit/cash top-up.

create unique index if not exists referral_earnings_payment_id_key
  on public.referral_earnings (payment_id)
  where payment_id is not null;

create or replace function public.accrue_referral_reward(
  p_referrer uuid,
  p_referred uuid,
  p_payment uuid,
  p_amount int
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_amb boolean;
  v_id uuid;
begin
  select is_ambassador into v_amb
    from public.profiles
   where user_id = p_referrer;

  if not found then
    return;
  end if;

  insert into public.referral_earnings (referrer_id, referred_id, payment_id, amount_kop, kind)
  values (p_referrer, p_referred, p_payment, p_amount, case when v_amb then 'cash' else 'credit' end)
  on conflict (payment_id) where payment_id is not null do nothing
  returning id into v_id;

  if v_id is null then
    return;
  end if;

  update public.profiles
     set cash_balance_kop   = cash_balance_kop   + case when v_amb then p_amount else 0 end,
         credit_balance_kop = credit_balance_kop + case when v_amb then 0 else p_amount end
   where user_id = p_referrer;
end;
$$;

revoke execute on function public.accrue_referral_reward(uuid, uuid, uuid, int) from public, anon, authenticated;
grant execute on function public.accrue_referral_reward(uuid, uuid, uuid, int) to service_role;
