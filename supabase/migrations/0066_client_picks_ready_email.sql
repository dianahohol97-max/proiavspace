-- 0066 · обране клієнта для Lightroom + лист клієнтові «Ваші фото готові»
--
-- 1) assets.source_file_name — назва файлу точно такою, як вона була на
--    диску фотографа («IMG_0012.jpg», «Весілля 001.jpg»). Досі назва жила
--    лише в r2_key, де вона санітизована (NFKD, усе, крім [A-Za-z0-9_.-], → «_»,
--    останні 80 символів), тож «DSC 0012.jpg» ставало «DSC_0012.jpg» і
--    Lightroom його не знаходив. original_name (0037) не годиться: на ній
--    унікальний індекс для імпорту zip, а звичайне завантаження двох файлів
--    з однаковою назвою (дві камери) — нормальна річ. Тут індексу немає.
--    Старі рядки лишаються NULL — код бере назву з r2_key, як і раніше.
--
-- 2) galleries.client_email — адреса клієнта, необовʼязкова; вписує фотограф
--    у кабінеті, лише з позначкою, що клієнт погодився на лист
--    (client_email_consent_at — коли фотограф це підтвердив).
--    galleries.ready_email_sent_at — коли пішов лист «Ваші фото готові»;
--    автоматичний лист іде лише поки тут NULL (не двічі), ручне «Надіслати
--    ще раз» оновлює час.
--
-- Гранти: public.galleries читається клієнтськими ролями лише за списком
-- колонок (0021, правило з 0032). Нові колонки galleries навмисно НЕ видані
-- anon/authenticated: адреса клієнта — персональні дані, а публічна галерея
-- читається будь-ким. Код читає й пише їх лише сервером (service role) після
-- перевірки власника. assets має табличні гранти (0033) — source_file_name
-- читається так само, як r2_key, у якому ця назва й так є.
--
-- Безпечно для коду на проді: лише нові nullable-колонки без дефолтів.
-- Код цього релізу без міграції теж працює: завантаження повторює insert без
-- source_file_name, а блок «Лист клієнтові» показує, що міграції ще немає.
--
-- Відкат:
--   alter table public.assets drop column if exists source_file_name;
--   alter table public.galleries drop column if exists client_email,
--     drop column if exists client_email_consent_at,
--     drop column if exists ready_email_sent_at;

alter table public.assets
  add column if not exists source_file_name text;

alter table public.assets
  drop constraint if exists assets_source_file_name_check;
alter table public.assets
  add constraint assets_source_file_name_check
  check (source_file_name is null or char_length(source_file_name) between 1 and 512);

alter table public.galleries
  add column if not exists client_email text,
  add column if not exists client_email_consent_at timestamptz,
  add column if not exists ready_email_sent_at timestamptz;

alter table public.galleries
  drop constraint if exists galleries_client_email_check;
alter table public.galleries
  add constraint galleries_client_email_check
  check (
    client_email is null
    or (char_length(client_email) <= 254 and client_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
  );

-- Адреса без підтвердженої згоди не зберігається.
alter table public.galleries
  drop constraint if exists galleries_client_email_consent_check;
alter table public.galleries
  add constraint galleries_client_email_consent_check
  check (client_email is null or client_email_consent_at is not null);

-- Явно: жодних грантів на нові колонки galleries для anon/authenticated.
revoke select (client_email, client_email_consent_at, ready_email_sent_at)
  on public.galleries from anon, authenticated;
