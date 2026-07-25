-- Fine-grained per-gallery design overrides on top of the theme preset:
-- accent colour, column count, corner radius and display font. NULL keys fall
-- back to the theme's own tokens, so an empty object changes nothing.
alter table public.galleries add column if not exists style jsonb;
