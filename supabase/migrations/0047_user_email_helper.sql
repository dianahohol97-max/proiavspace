-- E-mail of a user for server-side notifications (referral reward e-mails,
-- lib/referral-emails.ts). Service role only; avoids a GoTrue admin call per
-- e-mail. Kept out of 0044 so the applied migrations match the repo.

create or replace function public.user_email(p_user uuid)
returns text
language sql stable security definer set search_path = public
as $$
  select email from auth.users where id = p_user;
$$;
revoke execute on function public.user_email(uuid) from public, anon, authenticated;
grant execute on function public.user_email(uuid) to service_role;
