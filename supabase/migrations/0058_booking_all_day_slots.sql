-- Booking: "all day" slots (weddings, 10:00–22:00).
--
-- 0004 limited booking_slots.duration_minutes to 15–480 (8 h). A whole-day
-- slot that closes the day with ONE booking needs up to a full day. Only the
-- CHECK is widened; no data changes, no new columns.
--
-- Optional for the release: everything else in the new schedule works
-- without it. Until it is applied, creating a slot longer than 8 h fails with
-- a clear message in the dashboard ("needs a database update").

alter table public.booking_slots
  drop constraint if exists booking_slots_duration_minutes_check;

alter table public.booking_slots
  add constraint booking_slots_duration_minutes_check
  check (duration_minutes between 15 and 1440);
