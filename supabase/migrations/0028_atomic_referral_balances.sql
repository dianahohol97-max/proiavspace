-- Harden referral money against concurrency: do every balance change as a
-- single atomic UPDATE inside the database instead of read-then-write in JS,
-- so two payments landing at once can't clobber each other's increment.
-- These are service-role only (called from the billing webhook / admin actions);
-- a regular user must never be able to move their own balance.

-- Accrue a referral reward to the referrer and log it, atomically. The reward
-- goes to cash for an ambassador, otherwise to credit — decided from the
-- referrer's CURRENT flag inside the same statement.
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
begin
  update public.profiles
     set cash_balance_kop   = cash_balance_kop   + case when is_ambassador then p_amount else 0 end,
         credit_balance_kop = credit_balance_kop + case when is_ambassador then 0 else p_amount end
   where user_id = p_referrer
   returning is_ambassador into v_amb;

  if not found then
    return;
  end if;

  insert into public.referral_earnings (referrer_id, referred_id, payment_id, amount_kop, kind)
  values (p_referrer, p_referred, p_payment, p_amount, case when v_amb then 'cash' else 'credit' end);
end;
$$;

-- Consume redeemed проЯв credit, floored at zero (never goes negative).
create or replace function public.consume_credit(p_user uuid, p_amount int)
returns void
language sql security definer set search_path = public
as $$
  update public.profiles
     set credit_balance_kop = greatest(0, credit_balance_kop - p_amount)
   where user_id = p_user;
$$;

-- Return cash to an ambassador's balance (a rejected withdrawal), atomically.
create or replace function public.refund_cash(p_user uuid, p_amount int)
returns void
language sql security definer set search_path = public
as $$
  update public.profiles
     set cash_balance_kop = cash_balance_kop + p_amount
   where user_id = p_user;
$$;

revoke execute on function public.accrue_referral_reward(uuid, uuid, uuid, int) from public, anon, authenticated;
revoke execute on function public.consume_credit(uuid, int) from public, anon, authenticated;
revoke execute on function public.refund_cash(uuid, int) from public, anon, authenticated;
grant execute on function public.accrue_referral_reward(uuid, uuid, uuid, int) to service_role;
grant execute on function public.consume_credit(uuid, int) to service_role;
grant execute on function public.refund_cash(uuid, int) to service_role;
