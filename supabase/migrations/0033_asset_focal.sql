-- Per-photo focal point (0–100%), used by the cropped gallery layouts
-- (squares / portrait / collage / editorial) to aim object-position — the
-- photographer clicks the photo in the manage grid to pick what stays in
-- frame. NULL = center.
--
-- Grants: public.assets carries TABLE-level grants (verified in prod:
-- pg_attribute.attacl is empty for it), so new columns are covered
-- automatically — unlike public.galleries, whose column-list grant burned us
-- in 0032.
alter table public.assets
  add column if not exists focal_x smallint,
  add column if not exists focal_y smallint;
