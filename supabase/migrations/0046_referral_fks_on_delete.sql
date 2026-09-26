-- Deleting a user from Supabase Auth failed for anyone who had ever referred
-- or been referred (audit LC-03): the referral tables reference auth.users
-- without an ON DELETE action, so the cascade from auth.users stopped with
-- "violates foreign key constraint referrals_referred_id_fkey".
--
-- referrals / withdrawals go with the account (a deleted user has no referral
-- relationship left to show). referral_earnings is the money ledger: it stays,
-- with the deleted side set to null, so a referrer's balance history — and an
-- ambassador's cash-out record — survives the other party's deletion.

alter table public.referrals
  drop constraint if exists referrals_referrer_id_fkey,
  drop constraint if exists referrals_referred_id_fkey;
alter table public.referrals
  add constraint referrals_referrer_id_fkey
    foreign key (referrer_id) references auth.users (id) on delete cascade,
  add constraint referrals_referred_id_fkey
    foreign key (referred_id) references auth.users (id) on delete cascade;

alter table public.referral_earnings
  drop constraint if exists referral_earnings_referrer_id_fkey,
  drop constraint if exists referral_earnings_referred_id_fkey;
alter table public.referral_earnings
  alter column referrer_id drop not null,
  alter column referred_id drop not null;
alter table public.referral_earnings
  add constraint referral_earnings_referrer_id_fkey
    foreign key (referrer_id) references auth.users (id) on delete set null,
  add constraint referral_earnings_referred_id_fkey
    foreign key (referred_id) references auth.users (id) on delete set null;

alter table public.withdrawals
  drop constraint if exists withdrawals_user_id_fkey;
alter table public.withdrawals
  add constraint withdrawals_user_id_fkey
    foreign key (user_id) references auth.users (id) on delete cascade;

-- profiles.referred_by: the profile itself cascades with auth.users, but the
-- *referrer* may be deleted while the referred profile lives on.
alter table public.profiles
  drop constraint if exists profiles_referred_by_fkey;
alter table public.profiles
  add constraint profiles_referred_by_fkey
    foreign key (referred_by) references auth.users (id) on delete set null;
