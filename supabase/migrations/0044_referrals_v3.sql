-- Referral system v3 (see tests/referrals/REPORT.md for the audit behind it).
--
--   • Codes match case-insensitively and trimmed (BUG-06).
--   • A referral can be claimed after signup too — claim_referral() — so the
--     30-day ref cookie works for Google / magic-link signups (BUG-03).
--   • Self-referral (same account, same e-mail ignoring case and +alias, same
--     saved card) links nothing and earns nothing (BUG-09).
--   • An ambassador earns cash only from the first N payments of each referral
--     (N is passed by the app: lib/referrals.ts).
--   • A refund reverses the reward with a NEGATIVE earnings row; a balance may
--     go below zero and is paid off by later accruals (BUG-04).
--   • Credit is reserved when the payment row is created, inside one locked
--     transaction, so two open checkouts cannot spend the same credit (BUG-05).
--   • payments.referral_processed_at marks payments whose referral side
--     effects ran, so a daily repair pass can retry the ones that failed (BUG-12).
--   • The v1 pending_free_months column is gone (BUG-07).

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------
alter table public.profiles drop column if exists pending_free_months;
alter table public.payments add column if not exists referral_processed_at timestamptz;
create index if not exists payments_referral_repair_idx
  on public.payments (created_at)
  where status = 'paid' and referral_processed_at is null;

-- One positive (reward) and at most one negative (reversal) row per payment.
drop index if exists public.referral_earnings_payment_id_key;
create unique index if not exists referral_earnings_reward_per_payment
  on public.referral_earnings (payment_id)
  where payment_id is not null and amount_kop > 0;
create unique index if not exists referral_earnings_reversal_per_payment
  on public.referral_earnings (payment_id)
  where payment_id is not null and amount_kop < 0;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- "Diana.H+promo@Gmail.com" → "diana.h@gmail.com": what counts as the same
-- person for the self-referral rule.
create or replace function public.normalize_email(p_email text)
returns text
language sql immutable
as $$
  select case
    when p_email is null then null
    else lower(regexp_replace(split_part(p_email, '@', 1), '\+.*$', '')) || '@' ||
         lower(split_part(p_email, '@', 2))
  end;
$$;

-- Card tokens a user has ever paid with: saved subscriptions plus the
-- walletData of their Monobank payments.
create or replace function public.user_card_tokens(p_user uuid)
returns setof text
language sql stable security definer set search_path = public
as $$
  select card_token from public.billing_subscriptions where user_id = p_user
  union
  select raw -> 'walletData' ->> 'cardToken' from public.payments
   where user_id = p_user and raw -> 'walletData' ->> 'cardToken' is not null;
$$;
revoke execute on function public.user_card_tokens(uuid) from public, anon, authenticated;

-- Same account, same e-mail (normalized), or a shared card token.
create or replace function public.is_self_referral(
  p_referrer uuid,
  p_referred uuid,
  p_card_token text default null
)
returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare
  v_email_a text;
  v_email_b text;
begin
  if p_referrer is null or p_referred is null then
    return false;
  end if;
  if p_referrer = p_referred then
    return true;
  end if;
  select normalize_email(email) into v_email_a from auth.users where id = p_referrer;
  select normalize_email(email) into v_email_b from auth.users where id = p_referred;
  if v_email_a is not null and v_email_a = v_email_b then
    return true;
  end if;
  if p_card_token is not null
     and exists (select 1 from public.user_card_tokens(p_referrer) t where t = p_card_token) then
    return true;
  end if;
  if exists (
    select 1 from public.user_card_tokens(p_referrer) a
    join public.user_card_tokens(p_referred) b on a = b
  ) then
    return true;
  end if;
  return false;
end;
$$;
revoke execute on function public.is_self_referral(uuid, uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Linking: signup trigger + post-signup claim
-- ---------------------------------------------------------------------------

-- Resolve a code to its owner; null when unknown or when it belongs to the
-- signing-up person themself (by id or e-mail).
create or replace function public.resolve_referrer(p_code text, p_new_user uuid)
returns uuid
language plpgsql stable security definer set search_path = public
as $$
declare
  v_code text := lower(btrim(coalesce(p_code, '')));
  v_ref uuid;
begin
  if v_code = '' then
    return null;
  end if;
  select user_id into v_ref from public.profiles where referral_code = v_code;
  if v_ref is null or public.is_self_referral(v_ref, p_new_user) then
    return null;
  end if;
  return v_ref;
end;
$$;
revoke execute on function public.resolve_referrer(text, uuid) from public, anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  ref_user uuid;
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );

  -- The profile row exists now, so the self-referral e-mail check can see it.
  ref_user := public.resolve_referrer(new.raw_user_meta_data ->> 'ref', new.id);
  if ref_user is not null then
    update public.profiles set referred_by = ref_user where user_id = new.id;
    insert into public.referrals (referrer_id, referred_id)
    values (ref_user, new.id)
    on conflict (referred_id) do nothing;
  end if;

  return new;
end;
$$;

-- Called by the app right after any signup (auth callback / login page) with
-- the code from the ref cookie. Links only a fresh account (< 24 h) that has
-- no referrer yet; every other case is a silent no-op. Returns whether linked.
create or replace function public.claim_referral(p_code text)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_created timestamptz;
  v_ref uuid;
  v_linked boolean := false;
begin
  if v_me is null then
    return false;
  end if;
  select created_at into v_created from auth.users where id = v_me;
  if v_created is null or v_created < now() - interval '24 hours' then
    return false;
  end if;
  v_ref := public.resolve_referrer(p_code, v_me);
  if v_ref is null then
    return false;
  end if;

  update public.profiles
     set referred_by = v_ref
   where user_id = v_me and referred_by is null
   returning true into v_linked;
  if coalesce(v_linked, false) then
    insert into public.referrals (referrer_id, referred_id)
    values (v_ref, v_me)
    on conflict (referred_id) do nothing;
  end if;
  return coalesce(v_linked, false);
end;
$$;
revoke execute on function public.claim_referral(text) from public, anon;
grant execute on function public.claim_referral(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Money: accrue, reverse, reserve credit
-- ---------------------------------------------------------------------------

drop function if exists public.accrue_referral_reward(uuid, uuid, uuid, int);

-- Reward for one paid payment. Returns the amount actually accrued (0 when the
-- payment was already rewarded, the referrer is gone, it is a self-referral,
-- or the ambassador cap p_max_payments for this referral is reached).
create or replace function public.accrue_referral_reward(
  p_referrer uuid,
  p_referred uuid,
  p_payment uuid,
  p_amount int,
  p_card_token text default null,
  p_max_payments int default null
)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_amb boolean;
  v_id uuid;
  v_paid int;
begin
  if p_amount <= 0 then
    return 0;
  end if;
  select is_ambassador into v_amb from public.profiles where user_id = p_referrer;
  if not found then
    return 0;
  end if;
  if public.is_self_referral(p_referrer, p_referred, p_card_token) then
    return 0;
  end if;
  if v_amb and p_max_payments is not null then
    select count(*) into v_paid
      from public.referral_earnings
     where referrer_id = p_referrer and referred_id = p_referred and amount_kop > 0;
    if v_paid >= p_max_payments then
      return 0;
    end if;
  end if;

  insert into public.referral_earnings (referrer_id, referred_id, payment_id, amount_kop, kind)
  values (p_referrer, p_referred, p_payment, p_amount, case when v_amb then 'cash' else 'credit' end)
  on conflict (payment_id) where payment_id is not null and amount_kop > 0 do nothing
  returning id into v_id;
  if v_id is null then
    return 0;
  end if;

  update public.profiles
     set cash_balance_kop   = cash_balance_kop   + case when v_amb then p_amount else 0 end,
         credit_balance_kop = credit_balance_kop + case when v_amb then 0 else p_amount end
   where user_id = p_referrer;
  return p_amount;
end;
$$;
revoke execute on function public.accrue_referral_reward(uuid, uuid, uuid, int, text, int) from public, anon, authenticated;
grant execute on function public.accrue_referral_reward(uuid, uuid, uuid, int, text, int) to service_role;

-- Refund: take the reward back with a negative earnings row of the same kind.
-- The balance may go negative (an ambassador who already withdrew the money);
-- later accruals pay it off. Idempotent per payment. Returns the amount reversed.
create or replace function public.reverse_referral_reward(p_payment uuid)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  r record;
  v_id uuid;
begin
  select referrer_id, referred_id, amount_kop, kind
    into r
    from public.referral_earnings
   where payment_id = p_payment and amount_kop > 0;
  if not found then
    return 0;
  end if;

  insert into public.referral_earnings (referrer_id, referred_id, payment_id, amount_kop, kind)
  values (r.referrer_id, r.referred_id, p_payment, -r.amount_kop, r.kind)
  on conflict (payment_id) where payment_id is not null and amount_kop < 0 do nothing
  returning id into v_id;
  if v_id is null then
    return 0;
  end if;

  update public.profiles
     set cash_balance_kop   = cash_balance_kop   - case when r.kind = 'cash' then r.amount_kop else 0 end,
         credit_balance_kop = credit_balance_kop - case when r.kind = 'credit' then r.amount_kop else 0 end
   where user_id = r.referrer_id;
  return r.amount_kop;
end;
$$;
revoke execute on function public.reverse_referral_reward(uuid) from public, anon, authenticated;
grant execute on function public.reverse_referral_reward(uuid) to service_role;

-- Give back credit that was reserved against a payment that did not go through
-- (or was refunded).
create or replace function public.refund_credit(p_user uuid, p_amount int)
returns void
language sql security definer set search_path = public
as $$
  update public.profiles
     set credit_balance_kop = credit_balance_kop + p_amount
   where user_id = p_user and p_amount > 0;
$$;
revoke execute on function public.refund_credit(uuid, int) from public, anon, authenticated;
grant execute on function public.refund_credit(uuid, int) to service_role;

-- Create a pending payment and reserve проЯв credit against it atomically.
-- The profile row is locked, so concurrent checkouts are serialized and each
-- sees the credit already promised to the other's open (pending, < 48 h)
-- payments. Whole hryvnias only, and at least 1 ₴ is always left to pay.
-- Returns the row id, the final amount and the credit applied.
create or replace function public.create_pending_payment(
  p_user uuid,
  p_provider text,
  p_order_id text,
  p_plan text,
  p_period text,
  p_amount_uah int,
  p_purpose text default null,
  p_subscription uuid default null,
  p_apply_credit boolean default true
)
returns table (id uuid, amount int, credit_applied_kop int)
language plpgsql security definer set search_path = public
as $$
declare
  v_balance int;
  v_reserved int;
  v_available int;
  v_discount int := 0;
  v_amount int := p_amount_uah;
begin
  if p_apply_credit then
    select coalesce(credit_balance_kop, 0) into v_balance
      from public.profiles where user_id = p_user for update;
    select coalesce(sum(p.credit_applied_kop), 0) into v_reserved
      from public.payments p
     where p.user_id = p_user and p.status = 'pending'
       and p.created_at > now() - interval '48 hours';
    v_available := greatest(0, coalesce(v_balance, 0) - v_reserved);
    v_discount := least(v_available / 100, greatest(0, p_amount_uah - 1));
    v_amount := p_amount_uah - v_discount;
  end if;

  return query
  insert into public.payments
    (user_id, provider, order_id, plan, period, amount, currency, status,
     credit_applied_kop, purpose, subscription_id)
  values
    (p_user, p_provider, p_order_id, p_plan, p_period, v_amount, 'UAH', 'pending',
     v_discount * 100, p_purpose, p_subscription)
  returning payments.id, v_amount, v_discount * 100;
end;
$$;
revoke execute on function public.create_pending_payment(uuid, text, text, text, text, int, text, uuid, boolean) from public, anon, authenticated;
grant execute on function public.create_pending_payment(uuid, text, text, text, text, int, text, uuid, boolean) to service_role;

-- ---------------------------------------------------------------------------
-- Dashboard stats: only confirmed accounts count as invited (BUG-11)
-- ---------------------------------------------------------------------------
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
    (select count(*)::int from public.referrals r
       join auth.users u on u.id = r.referred_id
      where r.referrer_id = auth.uid() and u.email_confirmed_at is not null),
    (select count(*)::int from public.referrals where referrer_id = auth.uid() and status = 'converted'),
    (select coalesce(credit_balance_kop, 0) from public.profiles where user_id = auth.uid()),
    (select coalesce(cash_balance_kop, 0) from public.profiles where user_id = auth.uid()),
    (select coalesce(is_ambassador, false) from public.profiles where user_id = auth.uid());
$$;
revoke execute on function public.get_referral_stats() from public, anon;
grant execute on function public.get_referral_stats() to authenticated;
