-- Storage quota enforced in the database (audit ST-01).
--
-- Until now the only limit check was in the API: read profiles.storage_used_bytes,
-- compare, then insert the asset row. Two uploads finishing at the same moment
-- (several tabs) both read the old value and both get in — the quota was
-- overshot by up to (tabs × 2 GB). Here the check moves into a BEFORE INSERT
-- trigger that locks the profile row, so concurrent inserts serialize and the
-- second one sees the first one's bytes.
--
-- Effective limit mirrors effectiveGalleryPlan() in src/lib/plans.ts: once
-- grace_until has passed the account behaves as Free — its limit is the Free
-- allowance, whatever storage_limit_bytes still says. The Free allowance is the
-- same constant the profiles default uses (3 GB, 0001).
--
-- On violation the insert fails with message 'storage_quota_exceeded'; the
-- upload routes recognise it, remove the object from storage and answer 403
-- (lib/uploads.ts registerAsset, api/portfolio/complete).

create or replace function public.enforce_storage_quota()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_used  bigint;
  v_limit bigint;
  v_free  constant bigint := 3221225472; -- Free plan, 3 GB (plans.ts free.storageGb)
begin
  -- Serialize with every other insert (and the accounting trigger's update)
  -- for this owner.
  select storage_used_bytes,
         case when grace_until is not null and grace_until < now()
              then least(storage_limit_bytes, v_free)
              else storage_limit_bytes
         end
    into v_used, v_limit
    from public.profiles
   where user_id = new.owner_id
     for update;

  if not found then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;
  if v_used + new.size_bytes > v_limit then
    raise exception 'storage_quota_exceeded'
      using errcode = 'P0001',
            detail = format('used=%s add=%s limit=%s', v_used, new.size_bytes, v_limit);
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_storage_quota() from public, anon, authenticated;

drop trigger if exists assets_storage_quota on public.assets;
create trigger assets_storage_quota
  before insert on public.assets
  for each row execute function public.enforce_storage_quota();

drop trigger if exists portfolio_storage_quota on public.portfolio_assets;
create trigger portfolio_storage_quota
  before insert on public.portfolio_assets
  for each row execute function public.enforce_storage_quota();
