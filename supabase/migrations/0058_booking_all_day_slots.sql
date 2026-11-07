-- Booking (release 6): "all day" slots + no duplicate slots.
--
-- 1) "All day" slots (weddings, 10:00–22:00).
-- 0004 limited booking_slots.duration_minutes to 15–480 (8 h). A whole-day
-- slot that closes the day with ONE booking needs up to a full day. Only the
-- CHECK is widened; no data changes, no new columns.
--
-- Until it is applied, creating a slot longer than 8 h fails with a clear
-- message in the dashboard ("needs a database update").
--
-- 2) One slot per owner + start time. The app already skips starts that
-- exist, but a double click or two open tabs can race between that read and
-- the insert. The UNIQUE index closes the race; the app inserts with
-- ON CONFLICT (owner_id, starts_at) DO NOTHING and reports skipped rows as
-- "already exists" (src/lib/booking/slotInsert.ts).
-- Checked on prod before writing this: 0 slots, no duplicates — the index
-- builds without cleanup. If it ever fails with 23505, find duplicates with
--   select owner_id, starts_at, count(*) from booking_slots
--   group by 1, 2 having count(*) > 1;
-- The unique index also serves every query the old non-unique
-- booking_slots_owner_idx (owner_id, starts_at) did, so that one is dropped.

alter table public.booking_slots
  drop constraint if exists booking_slots_duration_minutes_check;

alter table public.booking_slots
  add constraint booking_slots_duration_minutes_check
  check (duration_minutes between 15 and 1440);

create unique index if not exists booking_slots_owner_starts_key
  on public.booking_slots (owner_id, starts_at);

drop index if exists public.booking_slots_owner_idx;
