-- Per-photo view tracking: a client opening a photo records a 'view' event
-- carrying the asset id in meta (page-level views from record_gallery_view
-- have no asset_id, so the two never mix). view_count is a direct counter and
-- is untouched. Public galleries only; deduped client-side per session.
create or replace function public.record_photo_view(p_slug text, p_asset uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  gid uuid;
begin
  select id into gid from public.galleries
    where slug = p_slug and is_published
      and (expires_at is null or expires_at > now());
  if gid is null then
    return;
  end if;
  insert into public.gallery_events (gallery_id, type, meta)
    values (gid, 'view', jsonb_build_object('asset_id', p_asset));
end;
$$;
revoke execute on function public.record_photo_view(text, uuid) from public;
grant execute on function public.record_photo_view(text, uuid) to anon, authenticated;
