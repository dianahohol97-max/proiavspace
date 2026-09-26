-- profiles: users may edit only their own presentation settings.
--
-- Until now `authenticated` held table-wide UPDATE and the owner-update policy
-- has no column restriction, so any signed-in user could PATCH their own row
-- through PostgREST and set plan / storage_limit_bytes / grace_until /
-- credit_balance_kop / cash_balance_kop / is_ambassador / referred_by … and
-- then request a real withdrawal.
--
-- Billing, storage, referral and promo columns are written only by the
-- service role (webhook, renewal cron, admin actions) and by SECURITY DEFINER
-- functions (apply_storage_delta, grant_import_promo, consume_credit,
-- accrue_referral_reward, request_withdrawal, refund_cash) — none of which
-- depend on the caller's column privileges.
--
-- Columns the app writes with the user's own client (lib/actions/profile.ts):
--   display_name, display_name_en, contact_url, watermark_enabled, logo_url.
-- updated_at is set by the touch_updated_at trigger, which needs no grant.

revoke update on public.profiles from anon, authenticated;

grant update (display_name, display_name_en, contact_url, watermark_enabled, logo_url)
  on public.profiles to authenticated;
