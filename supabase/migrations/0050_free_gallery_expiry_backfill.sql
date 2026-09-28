-- Existing galleries of Free accounts: not closed retroactively — they get
-- the same 30 days, counted from the day this is applied (= the merge day of
-- the launch-week PR, 0049). Paying accounts (plan in force, promo, grace)
-- get no deadline; if they lapse later, their galleries follow the plan
-- lifecycle of 0048, not this one.
update public.galleries g
   set free_expires_at = now() + interval '30 days'
 where g.free_expires_at is null
   and g.free_purged_at is null
   and not public.owner_has_paid_plan(g.owner_id);
