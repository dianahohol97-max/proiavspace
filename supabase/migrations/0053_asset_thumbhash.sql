-- 0053 · thumbhash для фото (БД-підготовка; генерації ще немає)
--
-- Навіщо: thumbhash — ~25 байт, з яких браузер малює розмиту заглушку
-- фото до завантаження прев'ю (без «стрибків» сітки й порожніх клітинок).
-- Поле необов'язкове: старі фото й відео лишаються з NULL, а код, що
-- рахує thumbhash при завантаженні, буде окремо.
--
-- Тип — text (base64), а не bytea: PostgREST віддає bytea як hex-рядок
-- «\x…», який довелося б перекодовувати на сервері; base64 іде в JSON як є
-- і напряму декодується бібліотекою thumbhash у браузері. Різниця в розмірі
-- (~36 символів проти 25 байт) на рядок нікчемна. CHECK лише страхує від
-- сміття — справжній thumbhash ніколи не довший за ~40 символів.
--
-- Гранти: public.assets має табличні гранти (див. 0033), тож нова колонка
-- читається тими самими ролями, що й решта. Писати її може лише service role
-- (0041 забрав insert/update у клієнтів).
--
-- Відкат:
--   alter table public.assets drop column if exists thumbhash;

alter table public.assets
  add column if not exists thumbhash text;

alter table public.assets
  drop constraint if exists assets_thumbhash_len;
alter table public.assets
  add constraint assets_thumbhash_len
  check (thumbhash is null or char_length(thumbhash) between 1 and 100);
