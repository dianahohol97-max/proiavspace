# Шаблони листів Supabase Auth (Brevo SMTP)

Custom SMTP уже ввімкнено (Brevo, `hello@proiav.space`, порт 465). Шаблони поки
дефолтні англійські — замінити на ці три. План Supabase Free: шаблони редагуються й на
Free, коли ввімкнено Custom SMTP.

**Де:** Supabase → проєкт `proiav.space` → **Authentication → Emails → Templates**.
Для кожного шаблону: вставити **Subject**, у полі **Message body** перемкнутися на
**Source** (не Preview), замінити весь вміст на HTML з файлу → **Save changes**.

| Шаблон у Supabase | Subject | Файл |
|---|---|---|
| **Confirm signup** | `проЯв · підтвердіть пошту` | `confirm-signup.html` |
| **Magic Link** | `проЯв · вхід у кабінет` | `magic-link.html` |
| **Reset Password** | `проЯв · новий пароль` | `reset-password.html` |

Інші шаблони (Invite user, Change Email Address, Reauthentication) застосунок не
використовує — не чіпати.

**Змінні.** Використано лише `{{ .ConfirmationURL }}` і `{{ .Email }}` — вони є в усіх
трьох шаблонах Supabase. Не замінювати `{{ .ConfirmationURL }}` на власне посилання:
воно веде через `/auth/callback`, де обмінюється код на сесію (і для «Забули пароль?»
далі на `/uk/reset-password`).

**Перевірка після збереження:**
1. Authentication → URL Configuration → Redirect URLs містить
   `https://proiav.space/auth/callback` (без нього посилання з листів відкинуться).
2. Зареєструвати тестову пошту → лист «проЯв · підтвердіть пошту» від `hello@proiav.space`.
3. Вкладка «Лінк на пошту» → лист «проЯв · вхід у кабінет».
4. Вхід → «Забули пароль?» → лист «проЯв · новий пароль» → посилання відкриває
   `/uk/reset-password`, новий пароль зберігається, вхід з ним працює.

**Якщо лист не приходить, а на сторінці «Не вдалося надіслати лист»:** Supabase →
Logs → Auth. `525 Unauthorized IP` означає, що в Brevo ввімкнено
**Security → Authorized IPs** — вимкнути для SMTP (див. `docs/KNOWN_DEBT.md`).
