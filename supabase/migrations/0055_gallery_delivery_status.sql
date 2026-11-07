-- 0055 · статус зйомки для клієнта (лише схема; інтерфейсу ще немає)
--
-- Навіщо: клієнт, відкривши посилання до того, як фото готові, має бачити
-- «зйомка пройшла / обробка / готово» і орієнтовну дату готовності, а не
-- порожню галерею.
--   delivery_status — NULL (статус не показуємо — як зараз), 'shot'
--                     («зйомка пройшла»), 'editing' («обробка»), 'ready'
--                     («готово»).
--   delivery_eta    — орієнтовна дата готовності (date, без часу: фотограф
--                     обіцяє день, а не годину; NULL — не вказано).
--
-- Гранти: public.galleries читається клієнтськими ролями лише за списком
-- колонок (0021, правило з 0032), тож обидві колонки треба видати явно —
-- інакше будь-який select з ними падає «permission denied».
-- Писати їх може власник (update на galleries у authenticated табличний).
--
-- Відкат:
--   alter table public.galleries drop column if exists delivery_status,
--                                drop column if exists delivery_eta;

alter table public.galleries
  add column if not exists delivery_status text,
  add column if not exists delivery_eta date;

alter table public.galleries
  drop constraint if exists galleries_delivery_status_check;
alter table public.galleries
  add constraint galleries_delivery_status_check
  check (delivery_status is null or delivery_status in ('shot', 'editing', 'ready'));

grant select (delivery_status, delivery_eta) on public.galleries to anon, authenticated;
