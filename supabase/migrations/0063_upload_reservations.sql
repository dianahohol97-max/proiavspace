-- Unfinished multipart uploads count against the storage quota (plan 4.3).
--
-- A multipart upload's parts sit in B2 — and are billed — from the first part
-- until CompleteMultipartUpload or AbortMultipartUpload. With resumable uploads
-- (the browser keeps an open upload for up to ~20 h so it can continue after a
-- dropped network or a reloaded tab) these bytes are no longer "a few minutes
-- in flight", so they are reserved here:
--
--   * /api/uploads/multipart/create inserts a row with the declared size, after
--     checking  storage_used_bytes + open reservations + this file <= limit;
--   * /api/uploads/multipart/complete and .../abort delete it (the asset row
--     then carries the bytes through the existing accounting trigger);
--   * /api/cron/storage-cleanup aborts uploads older than 24 h in B2 and deletes
--     their rows (and any row older than 24 h whose upload is already gone).
--
-- Only the service role touches this table (API routes, cron): RLS on, no
-- policies for anon/authenticated. Until this migration is applied the code
-- treats the table as absent and skips reservations (old behaviour).

create table if not exists public.upload_reservations (
  upload_id   text primary key,
  owner_id    uuid not null references public.profiles (user_id) on delete cascade,
  gallery_id  uuid references public.galleries (id) on delete cascade,
  r2_key      text not null,
  size_bytes  bigint not null check (size_bytes > 0),
  created_at  timestamptz not null default now()
);

create index if not exists upload_reservations_owner_created
  on public.upload_reservations (owner_id, created_at);

alter table public.upload_reservations enable row level security;

revoke all on public.upload_reservations from anon, authenticated;

comment on table public.upload_reservations is
  'Open multipart uploads and their declared size; counted against the quota until completed, aborted or swept (24 h).';
