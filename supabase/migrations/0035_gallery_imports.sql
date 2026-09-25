-- Zip import from other services (Pixieset, Pic-Time, …). The browser unzips
-- and uploads each file through the regular direct-to-storage flow; the
-- database only records what came from where, so an import can be reported,
-- resumed and de-duplicated.
--
-- Existing galleries are untouched: every new column is nullable and only the
-- import flow ever sets it.

create table if not exists public.gallery_imports (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null references auth.users (id) on delete cascade,
  zip_name            text not null,
  status              text not null default 'running'
                        check (status in ('running', 'completed')),
  files_total         int not null default 0,
  -- Filled by the finish endpoint from the assets actually registered (not
  -- from what the browser claims), the skip counters come from the browser.
  imported_count      int not null default 0,
  imported_bytes      bigint not null default 0,
  skipped_duplicate   int not null default 0,
  skipped_unsupported int not null default 0,
  skipped_video       int not null default 0,
  failed_count        int not null default 0,
  created_at          timestamptz not null default now(),
  completed_at        timestamptz
);

create index if not exists gallery_imports_owner_idx
  on public.gallery_imports (owner_id, created_at desc);

alter table public.gallery_imports enable row level security;

create policy "gallery_imports: owner select"
  on public.gallery_imports for select
  using (auth.uid() = owner_id);

-- A new import can only start empty; the counters are written solely by
-- finish_gallery_import() below (no update policy on purpose).
create policy "gallery_imports: owner insert running"
  on public.gallery_imports for insert
  with check (
    auth.uid() = owner_id
    and status = 'running'
    and imported_count = 0
    and imported_bytes = 0
    and completed_at is null
  );

-- Which gallery a zip folder landed in, keyed by the generated title
-- («Назва zip — Папка»). Importing the same zip again (a closed tab, or a
-- service that split one gallery into several zips) reuses that gallery and
-- only uploads what is missing. Kept out of public.galleries on purpose: that
-- table has a column-list select grant (see 0032).
create table if not exists public.imported_galleries (
  gallery_id  uuid primary key references public.galleries (id) on delete cascade,
  owner_id    uuid not null references auth.users (id) on delete cascade,
  source_key  text not null,
  created_at  timestamptz not null default now(),
  unique (owner_id, source_key)
);

alter table public.imported_galleries enable row level security;

create policy "imported_galleries: owner all"
  on public.imported_galleries for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- assets carries table-level grants (see 0033), so these are readable as-is.
alter table public.assets
  add column if not exists original_name text,
  add column if not exists import_id uuid references public.gallery_imports (id) on delete set null;

-- Duplicate guard for imports: one file name per gallery. Regular uploads
-- leave original_name NULL, so they are never affected by this index.
create unique index if not exists assets_gallery_original_name_uidx
  on public.assets (gallery_id, original_name)
  where original_name is not null;

create index if not exists assets_import_idx
  on public.assets (import_id)
  where import_id is not null;

-- Close an import: imported count/bytes are recomputed from the assets that
-- were really registered under it; the skip counters are what the browser saw
-- inside the zip (nothing to verify them against — they only feed the report).
create or replace function public.finish_gallery_import(
  p_import_id uuid,
  p_skipped_duplicate int,
  p_skipped_unsupported int,
  p_skipped_video int,
  p_failed int
)
returns public.gallery_imports
language sql
security definer
set search_path = public
as $$
  update public.gallery_imports i
     set status = 'completed',
         completed_at = now(),
         imported_count = agg.n,
         imported_bytes = agg.bytes,
         skipped_duplicate = greatest(p_skipped_duplicate, 0),
         skipped_unsupported = greatest(p_skipped_unsupported, 0),
         skipped_video = greatest(p_skipped_video, 0),
         failed_count = greatest(p_failed, 0)
    from (
      select count(*)::int as n, coalesce(sum(size_bytes), 0)::bigint as bytes
        from public.assets
       where import_id = p_import_id
    ) agg
   where i.id = p_import_id
     and i.owner_id = auth.uid()
     and i.status = 'running'
  returning i.*;
$$;

revoke execute on function public.finish_gallery_import(uuid, int, int, int, int) from public, anon;
grant execute on function public.finish_gallery_import(uuid, int, int, int, int) to authenticated;
