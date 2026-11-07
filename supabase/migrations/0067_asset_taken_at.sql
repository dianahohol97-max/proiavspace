-- Capture time of a photo (feat/gallery-grid → release/4).
--
-- 1. assets.taken_at: when the photo was taken, read from its EXIF in the
--    browser at upload (DateTimeOriginal, sub-seconds included). Stored as the
--    camera's WALL-CLOCK time written as UTC: one shoot happens in one time
--    zone, and a Canon that writes no offset must interleave with an iPhone
--    that does (src/lib/images/exif.ts). NULL for videos, screenshots and
--    photos uploaded before this migration. Nullable, no default: safe for
--    the code now in production (it never names the column). The upload code
--    in this release writes it and, if the column is missing, retries the
--    insert without it (uploads.ts, isMissingColumn), so it works before and
--    after this migration.
--
--    Reads: assets carries TABLE-level select grants (see 0033), so the new
--    column is readable as-is; writes stay service-role only (0041).
--
-- 2. sort_gallery_assets(p_gallery, p_mode): the dashboard's «Впорядкувати
--    за часом зйомки» / «за часом завантаження». Rewrites assets.position
--    (1..n) for one gallery in one statement. SECURITY DEFINER because
--    authenticated has no UPDATE on position (0041); the function itself
--    checks that the caller owns the gallery. Photos without a capture time
--    go last, in upload order.

alter table public.assets add column if not exists taken_at timestamptz;

create or replace function public.sort_gallery_assets(p_gallery uuid, p_mode text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  changed integer;
begin
  if p_mode is null or p_mode not in ('taken', 'uploaded') then
    raise exception 'invalid_sort_mode';
  end if;
  if auth.uid() is null or not exists (
    select 1 from public.galleries g where g.id = p_gallery and g.owner_id = auth.uid()
  ) then
    raise exception 'gallery_not_found';
  end if;

  with ordered as (
    select a.id,
           row_number() over (
             order by
               case when p_mode = 'taken' then a.taken_at end asc nulls last,
               a.created_at asc,
               a.id asc
           ) as rn
    from public.assets a
    where a.gallery_id = p_gallery
  )
  update public.assets a
     set position = o.rn
    from ordered o
   where a.id = o.id
     and a.position is distinct from o.rn;

  get diagnostics changed = row_count;
  return changed;
end;
$$;

revoke all on function public.sort_gallery_assets(uuid, text) from public;
revoke all on function public.sort_gallery_assets(uuid, text) from anon;
grant execute on function public.sort_gallery_assets(uuid, text) to authenticated;
