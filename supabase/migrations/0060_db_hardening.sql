-- Supabase security advisor clean-up (feat/db-hardening).
--
-- 1. function_search_path_mutable: normalize_email and plan_storage_bytes ran
--    with the caller's search_path. Pin it to public. ALTER FUNCTION only
--    attaches the setting; bodies, signatures, volatility and grants stay.
--
-- 2. profiles_clear_free_expiry() is a SECURITY DEFINER trigger function that
--    anon and authenticated could EXECUTE (Supabase's default privileges grant
--    it on every new function; 0049 never revoked it), so it showed up as
--    /rest/v1/rpc/profiles_clear_free_expiry. Postgres checks EXECUTE on a
--    trigger function only at CREATE TRIGGER time, not when the trigger
--    fires, so the profiles trigger keeps working (same pattern as 0011,
--    0045, 0056, 0057).
--
-- 3. owner_has_paid_plan(uuid): 0049 meant it for authenticated only, but
--    `revoke ... from public` does not remove Supabase's explicit anon grant,
--    so anyone could ask whether a given user id is on a paid plan. Nothing
--    anon runs depends on it: no RLS policy or view uses it; its callers are
--    the galleries_free_expiry_guard trigger (SECURITY INVOKER, calls it only
--    on INSERT into galleries, which anon cannot do) and the service-role
--    functions free_expiry_candidates / purge_free_gallery. authenticated
--    keeps EXECUTE: the trigger runs as the photographer creating a gallery.
--
-- 4. release_expired_slots(p_owner): any signed-in user could release another
--    photographer's expired unpaid bookings. Now a caller with a JWT subject
--    (auth.uid() not null) may only release their own slots; otherwise the
--    function does nothing and returns 0. Service role and server-side jobs
--    have no subject, so they work as before. The only caller in the app is
--    the photographer's own dashboard (dashboard/booking/page.tsx, p_owner =
--    user.id). Body otherwise unchanged from 0005; signature and grants stay.
--
-- Safe for the code currently in production. Covered by
-- tests/audit-storage/db-hardening.test.ts.
--
-- Rollback:
--   alter function public.normalize_email(text) reset search_path;
--   alter function public.plan_storage_bytes(text) reset search_path;
--   grant execute on function public.profiles_clear_free_expiry()
--     to public, anon, authenticated;
--   grant execute on function public.owner_has_paid_plan(uuid) to anon;
--   -- release_expired_slots: re-run its definition from
--   -- 0005_booking_automation.sql (the block below without the
--   -- `if auth.uid() ...` check); grants are kept by create or replace.

alter function public.normalize_email(text) set search_path = public;
alter function public.plan_storage_bytes(text) set search_path = public;

revoke execute on function public.profiles_clear_free_expiry() from public, anon, authenticated;

revoke execute on function public.owner_has_paid_plan(uuid) from public, anon;

create or replace function public.release_expired_slots(p_owner uuid)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_count integer;
begin
  -- Signed-in callers may only touch their own slots.
  if auth.uid() is not null and auth.uid() is distinct from p_owner then
    return 0;
  end if;

  update public.booking_slots b
     set status = 'free',
         client_name = null,
         client_phone = null,
         client_email = null,
         booking_token = null,
         payment_method = null,
         invoice_id = null,
         booked_at = null
    from public.booking_settings s
   where s.user_id = b.owner_id
     and b.owner_id = p_owner
     and b.status = 'booked'
     and b.price_uah > 0
     and s.unpaid_release_hours > 0
     and b.booked_at < now() - make_interval(hours => s.unpaid_release_hours);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
