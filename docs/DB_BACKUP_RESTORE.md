# Бекап бази: як влаштовано і як відновити (BK-01)

## Що робить `.github/workflows/db-backup.yml`

- Щодня о 02:17 UTC (і вручну: Actions → «DB — nightly backup to B2» → Run workflow).
- `pg_dump` схем `public` і `auth` у форматі custom (`--format=custom --compress=6` — уже стиснений, окремо gzip не потрібен).
- У тому ж job дамп відновлюється в порожній Postgres 17 і порівнюються кількості рядків `profiles`, `galleries`, `assets`, `payments`, `auth.users`. Якщо дамп не відновлюється, job червоний.
- Завантаження в **окремий** бакет B2 (`B2_BACKUP_BUCKET`, не медіа-бакет) під префікс `db/`: `db/proiav-YYYY-MM-DDTHHMMSSZ.dump`. Після цього звіряється розмір.
- Лишаються **14 найновіших** дампів, старші видаляються. Ротація стартує лише тоді, коли сьогоднішній дамп уже лежить у бакеті.
- **Без секрету `SUPABASE_DB_URL`** job пропускається (зелений, з попередженням «DB backup skipped»). Якщо `SUPABASE_DB_URL` є, а B2-секретів немає, job червоний: напівналаштований бекап має бути видно.

### Секрети (GitHub → Settings → Secrets and variables → Actions → Secrets)

| Секрет | Що це |
|---|---|
| `SUPABASE_DB_URL` | Supabase → Connect → **Session pooler** URI (порт 5432, IPv4; прямий `db.*` — лише IPv6, з GitHub не працює). Пароль бази — усередині рядка |
| `B2_BACKUP_KEY_ID`, `B2_BACKUP_APPLICATION_KEY` | Application key B2 **лише на бакет бекапів**: `listFiles, readFiles, writeFiles, deleteFiles` (delete потрібен для ротації 14 копій) |
| `B2_BACKUP_BUCKET` | напр. `proiav-db-backups` |
| `B2_BACKUP_REGION` | напр. `eu-central-003` (з Endpoint бакета `s3.<region>.backblazeb2.com`) |

### Бакет B2

Private. За бажанням — Object Lock (захист від того, що вкрадений ключ зітре бекапи) з default retention **не довшою за 14 днів**. Тоді ротація встигне видаляти: у бакеті з Object Lock видалення без версії лише ховає файл, а сама версія живе до кінця блокування. Lifecycle-правило: «Keep only the last version» (приховані версії видаляються через 1 день після того, як блокування мине). Якщо блокування довше за 14 днів, ротація пише попередження «could not delete … (Object Lock?)» і пробує знову наступної ночі. Job від цього не падає.

## Відновлення

Потрібен клієнт Postgres **17** (як на сервері Supabase). `pg_restore` старішої версії не прочитає дамп від `pg_dump` 17.

### 1. Завантажити дамп

```bash
export AWS_ACCESS_KEY_ID=<B2 keyID> AWS_SECRET_ACCESS_KEY=<B2 applicationKey> AWS_DEFAULT_REGION=eu-central-003
aws --endpoint-url https://s3.eu-central-003.backblazeb2.com s3 ls s3://proiav-db-backups/db/
aws --endpoint-url https://s3.eu-central-003.backblazeb2.com s3 cp s3://proiav-db-backups/db/proiav-2026-11-07T021700Z.dump .
```
(або B2 → Browse Files → бакет → `db/` → Download).

### 2. Подивитися або перевірити локально (безпечно, прод не чіпається)

```bash
docker run -d --name restore -e POSTGRES_PASSWORD=restore -p 5432:5432 postgres:17
psql postgres://postgres:restore@localhost:5432/postgres -c "create database r"
pg_restore --list proiav-2026-11-07T021700Z.dump | less          # що всередині
pg_restore --dbname postgres://postgres:restore@localhost:5432/r \
  --no-owner --no-privileges proiav-2026-11-07T021700Z.dump
# Помилки про ролі/розширення Supabase (supabase_auth_admin, pgsodium …) і
# «schema public already exists» очікувані: таблиці й дані відновлюються.
psql postgres://postgres:restore@localhost:5432/r -c "select count(*) from public.galleries"
```

### 3. Повернути кілька рядків, видалених помилково (типовий випадок)

Не відновлювати дамп поверх проду. Відновити локально (крок 2), знайти рядки і перенести тільки їх:

```bash
# локально: вивантажити потрібні рядки
psql postgres://postgres:restore@localhost:5432/r -c \
  "\copy (select * from public.galleries where owner_id = '<uuid>') to 'galleries.csv' csv header"
# на проді: завантажити назад (спершу батьківські таблиці, потім дочірні: galleries → assets → selections)
psql "$SUPABASE_DB_URL" -c "\copy public.galleries from 'galleries.csv' csv header"
```
Тригер квоти (0045) спрацює на `assets`: якщо місця немає, вставка відхиляється з `storage_quota_exceeded`, і її видно одразу.

### 4. Повне відновлення (база втрачена) — у **новий** проєкт Supabase

1. Створити проєкт у тому ж регіоні (eu-central-1). Поки нічого не накочувати.
2. Користувачі Auth, тільки дані (таблиці `auth` у новому проєкті вже створив Supabase, тригера `on_auth_user_created` ще немає, тож профілі не дублюються):
   ```bash
   pg_restore --dbname "$NEW_DB_URL" --no-owner --no-privileges --data-only \
     --schema=auth --table=users --table=identities proiav-….dump
   ```
3. Схема `public` разом із даними, функціями, політиками й тригерами:
   ```bash
   pg_restore --dbname "$NEW_DB_URL" --no-owner --no-privileges --schema=public proiav-….dump
   ```
4. Тригер на `auth.users` живе в схемі `auth`, тож у кроці 3 він не відновився. Повернути його:
   ```sql
   create trigger on_auth_user_created after insert on auth.users
     for each row execute function public.handle_new_user();
   ```
5. Гранти API-ролям: `--no-privileges` їх не переносить. Виконати SQL-блок «Grants» з кінця кожної міграції або простіше:
   ```sql
   grant usage on schema public to anon, authenticated, service_role;
   grant all on all tables in schema public to anon, authenticated, service_role;
   grant all on all sequences in schema public to anon, authenticated, service_role;
   grant all on all functions in schema public to anon, authenticated, service_role;
   ```
   Потім **перевиконати ревоки** з міграцій 0011, 0020, 0021 (+ column-list grant з 0021/0032/0049/0055), 0041, 0043, 0057, бо `grant all` вище їх знімає. Найпростіше: прогнати ці файли ще раз (вони ідемпотентні в частині grant/revoke) і перевірити: `select has_column_privilege('anon','public.galleries','password_hash','select')` → `f`.
6. Звірити кількості рядків з останнього успішного запуску workflow (лог кроку «Dump»).
7. Перемкнути `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` у Vercel на новий проєкт і зробити redeploy. Шаблони листів Auth, Redirect URLs і SMTP налаштувати заново (див. `docs/email-templates/supabase/README.md`).

Файли фото в B2 бекапом бази не покриваються, але й не залежать від нього: рядки `assets` з дампа вказують на ті самі ключі в медіа-бакеті.

### Раз на квартал

Завантажити свіжий дамп і пройти крок 2. Workflow і так робить це щоночі, але ручна перевірка показує, що ключ B2 і інструкція досі робочі.
