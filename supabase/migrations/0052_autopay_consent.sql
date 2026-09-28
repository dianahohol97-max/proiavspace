-- Auto-renewal only with the payer's consent (29.09.2026).
--
-- Until now every Monobank invoice asked to save the card (saveCardData) and
-- the webhook turned any returned card token into an auto-renewing
-- subscription — there was no consent step on our side. From now on:
--   • the plans page has a visible «Автопродовження: … ₴ щомісяця / щороку,
--     можна скасувати будь-коли в кабінеті» checkbox next to the pay button;
--   • checkout stores the answer here and asks the provider to save the card
--     only when it is on (the import-promo «Підключити автоплатіж» button is
--     consent by itself);
--   • the webhook creates a subscription only for a consented payment and
--     deletes a token that arrives without consent.

alter table public.payments
  add column if not exists autopay_consent boolean not null default false;

-- «Через 3 дні спишемо …» — one letter per subscription and charge date
-- (charge_at = the next_charge_at the letter was about). Written by the
-- renewal cron, service role only.
create table if not exists public.renewal_notices (
  subscription_id uuid not null references public.billing_subscriptions (id) on delete cascade,
  charge_at       timestamptz not null,
  sent_at         timestamptz not null default now(),
  primary key (subscription_id, charge_at)
);
alter table public.renewal_notices enable row level security;
-- No policies: service role only.
