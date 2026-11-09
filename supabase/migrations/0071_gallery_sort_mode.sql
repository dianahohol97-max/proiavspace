-- Gallery order mode (feat/gallery-sort-mode → release/4). Needs 0067
-- (assets.taken_at, sort_gallery_assets): apply 0067 first, then this.
--
-- 1. galleries.sort_mode: 'manual' (default — the order the photographer
--    set: upload / zip order, new photos at the end) or 'taken_at' (shot
--    order: after every upload batch and zip import the app calls
--    sort_gallery_assets, so new frames land among their neighbours by EXIF
--    capture time; photos without one go last). NOT NULL with a default:
--    safe for the code in production, which never names the column.
--
--    galleries has COLUMN-LIST select grants (0021, see the rule in 0032):
--    a new column must be granted explicitly, or every `select *` on
--    galleries fails with «permission denied». The mode is not sensitive.
--    Writes: only through sort_gallery_assets below (it checks ownership).
--
-- 2. sort_gallery_assets(p_gallery, p_mode): same signature as 0067, now
--    also remembers the mode: 'taken' → sort_mode = 'taken_at',
--    'uploaded' → sort_mode = 'manual'. The ordering itself is unchanged.
--
-- Without this migration the app treats every gallery as 'manual'
-- (src/lib/gallery/sortMode.ts); with 0067 but not 0071 the sort buttons
-- still reorder, they just don't remember the mode.

alter table public.galleries
  add column if not exists sort_mode text not null default 'manual';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'galleries_sort_mode_check' and conrelid = 'public.galleries'::regclass
  ) then
    alter table public.galleries
      add constraint galleries_sort_mode_check check (sort_mode in ('manual', 'taken_at'));
  end if;
end $$;

grant select (sort_mode) on public.galleries to anon, authenticated;

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

  update public.galleries
     set sort_mode = case when p_mode = 'taken' then 'taken_at' else 'manual' end
   where id = p_gallery
     and sort_mode is distinct from case when p_mode = 'taken' then 'taken_at' else 'manual' end;

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
