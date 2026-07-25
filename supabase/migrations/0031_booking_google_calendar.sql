-- Google Calendar sync for booking.
-- One-way push: when a client books a slot, proЯв creates an event in the
-- photographer's Google Calendar so their bookings live where they already
-- plan their days. The photographer connects their account via OAuth; we keep
-- only the long-lived refresh token (owner-scoped under existing RLS) and the
-- calendar id to write to. google_event_id on a slot lets us update/remove the
-- event when the booking is reopened or canceled.

alter table public.booking_settings
  add column if not exists google_refresh_token text,
  add column if not exists google_calendar_id text not null default 'primary',
  add column if not exists google_email text;

alter table public.booking_slots
  add column if not exists google_event_id text;

comment on column public.booking_settings.google_refresh_token is
  'OAuth refresh token for the photographer''s Google Calendar; null = not connected.';
comment on column public.booking_slots.google_event_id is
  'Id of the pushed Google Calendar event, so it can be updated/deleted.';
