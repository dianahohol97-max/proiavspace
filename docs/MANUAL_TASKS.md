# Ручні задачі (не виконані, чекають доступу)

## Бекфіл width/height для assets і portfolio_assets

**Статус:** не зроблено. Запускати, коли буде доступ до Supabase.

**Навіщо.** У частини старих фото `width`/`height` дорівнюють `NULL`: HEIC та інші формати, які
браузер фотографа не розкодував під час завантаження, тож розміри не записалися. У сітці masonry
такі фото показуються повністю у слоті 4:5 (`object-fit: contain` на нейтральному фоні), а не у своїх
пропорціях. Після бекфілу вони стануть звичайними плитками.

**Що зробити.** Скрипт, який:
1. вибирає рядки `assets` і `portfolio_assets`, де `width is null or height is null`, а в
   `variants` є `preview` (для відео — `poster`);
2. читає розміри з варіанта `preview` у B2: достатньо перших ~64 КБ (Range-запит) і заголовка
   JPEG/WebP (наприклад, `image-size` або `sharp().metadata()`);
3. перераховує їх у розміри оригіналу. Прев'ю зменшене зі збереженням пропорцій, тож для сітки
   пропорції точні. Для `width`/`height` можна записати розміри прев'ю або, якщо оригінал читається
   (`sharp` вміє HEIC не завжди), — оригіналу;
4. оновлює рядки пачками, без зміни `size_bytes` (облік місця не чіпаємо);
5. має режим `--dry-run` і звіт: скільки рядків, скільки оновлено, скільки без прев'ю.

Міграція не потрібна: поля вже є. Запускати сервісним ключем з локальної машини або разової
функції, не з браузера.

## Часовий пояс фотографа в бронюванні

**Статус:** не зроблено (release/6 свідомо без міграції).

**Зараз.** Усі слоти — це «настінний» час без зсуву (`booking_slots.starts_at timestamp`), і всюди
він трактується як Europe/Kyiv: константа `DEFAULT_BOOKING_TIME_ZONE` у `src/lib/booking/time.ts`,
події в Google (`BOOKING_TIME_ZONE`), перетин із freeBusy, відсікання минулих слотів у
генераторі шаблонів і RPC `get_free_slots` (міграція 0018 порівнює з `now() at time zone 'Europe/Kyiv'`).
Поля з поясом у `profiles` / `booking_settings` немає.

**Що зробити, коли з'являться фотографи не з України.**
1. Міграція: `alter table booking_settings add column time_zone text not null default 'Europe/Kyiv'`
   (перевірка значення — у коді через `Intl.supportedValuesOf('timeZone')`).
2. `get_free_slots`: порівнювати з `now() at time zone s.time_zone`.
3. Передати пояс у `generateSlots(..., { timeZone })`, `hideBusySlots` / `checkSlotWithGoogle`
   (`options.timeZone`) та `insertCalendarEvent({ timeZone })` — усі вже приймають параметр.
4. Поле вибору поясу в «Бронювання → Налаштування» і показ поясу клієнту на /b/[handle].

## Google Calendar: дозволи для перевірки зайнятості (release/6)

**Статус:** треба зробити в Google Cloud Console до або одразу після деплою release/6.

1. APIs & Services → OAuth consent screen → Data access (Scopes): додати
   `https://www.googleapis.com/auth/calendar.freebusy` і
   `https://www.googleapis.com/auth/calendar.calendarlist.readonly` (поруч із наявними
   `calendar.events` і `userinfo.email`).
2. Обидва — «sensitive» scopes. Якщо застосунок у статусі Production і вже верифікований для
   `calendar.events`, Google попросить повторну перевірку (Verification Center → Prepare for
   verification): пояснення використання, відео з екраном згоди й місцем, де дані показуються
   (кабінет → Бронювання → «Враховувати зайнятість із календарів»), посилання на політику
   конфіденційності. Поки перевірка триває, користувачі бачать екран «unverified app»,
   а ліміт — 100 нових користувачів.
3. Перевірити, що Google Calendar API увімкнено (APIs & Services → Library) — freeBusy і
   calendarList входять у той самий API.
4. Нічого не міняти в Redirect URI / Client ID — вони ті самі.
5. Фотографи, підключені раніше, побачать у кабінеті «Перепідключіть календар, щоб
   враховувати зайнятість». До перепідключення все працює як раніше (лише запис подій).

## Міграція 0058 (слоти «весь день» довші за 8 год)

**Статус:** файл є, не застосовано. Без неї слоти до 8 год (зокрема «весь день» 10:00–18:00)
працюють; 10:00–22:00 кабінет відхилить зі зрозумілим повідомленням. Застосувати
`supabase/migrations/0058_booking_all_day_slots.sql` перед мержем release/6, якщо весільні
слоти потрібні одразу.
