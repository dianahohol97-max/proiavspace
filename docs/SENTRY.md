# Sentry: сповіщення про помилки з проду

Код уже в репозиторії (`@sentry/nextjs`). Він вмикається лише тоді, коли задано змінну
`NEXT_PUBLIC_SENTRY_DSN`. Без неї Sentry повністю вимкнений: у збірку не потрапляє, нічого
не надсилає. Так працює локально, у тестах і в CI.

## Що ловиться і що вирізається

- Помилки в браузері, на сервері (Node) і в middleware (edge), а також помилки, які
  перехопили сторінки помилок (`error.tsx`, `global-error.tsx`).
- Лише помилки: трасування продуктивності й запис сесій вимкнені.
- Персональні дані не надсилаються. `sendDefaultPii` вимкнено, а кожна подія перед відправкою
  проходить через `src/lib/sentry/options.ts`:
  - видаляється `user`, cookie, тіло запиту й query-рядок;
  - заголовки `Cookie`, `Authorization`, IP вирізаються;
  - email і номери телефонів у будь-якому тексті замінюються на `[email]` і `[phone]`;
  - у посиланнях вирізаються значення `token`, `password`, `code`, `key`, `email`, `phone`, підписи
    `X-Amz-*` тощо.
- Помилка `refresh_token_not_found` (застарілий вхід у middleware) очікувана і не надсилається.

## Що зробити руками (≈ 10 хв)

### 1. Акаунт: обери один варіант

**Sentry Developer (безкоштовно, 5 000 помилок на місяць, 1 користувач)**
1. Зареєструйся на <https://sentry.io/signup/>. Під час реєстрації обери регіон даних
   **European Union (Frankfurt)**. Тариф: **Developer (Free)**.
2. Create Project → платформа **Next.js** → назва `proiav` → Create Project.
   Майстер запропонує `npx @sentry/wizard`: **не запускай**, код уже готовий.
3. DSN: **Settings → Projects → proiav → Client Keys (DSN)**. Скопіюй рядок виду
   `https://<ключ>@o<число>.ingest.de.sentry.io/<число>`.

**GlitchTip (сумісний з Sentry, безкоштовно до 1 000 подій на місяць)**
1. Зареєструйся на <https://app.glitchtip.com/register>.
2. Створи Organization, далі **Projects → Create New Project** → платформа JavaScript/Next.js →
   назва `proiav`.
3. DSN: у налаштуваннях проєкту, розділ **Client Keys (DSN)**. GlitchTip показує його й одразу
   після створення проєкту.

### 2. Додати змінну у Vercel

Домен `proiav.space` прив'язаний до проєкту **`dianatracker-dtks`**, тож змінну додаємо саме туди.

1. Vercel → проєкт **dianatracker-dtks** → **Settings → Environment Variables**.
2. Key: `NEXT_PUBLIC_SENTRY_DSN`, Value: DSN з кроку 1, Environment: **Production**
   (Preview за бажанням) → Save.
3. Змінна `NEXT_PUBLIC_*` вбудовується під час збірки, тож потрібна нова збірка `main`.
   Окремий Redeploy не потрібен: досить, щоб змінна була додана **до** мержу релізу.

### 3. (Необов'язково) Читабельні стеки викликів, лише для Sentry

Без цього помилки однаково приходять, але стек показує мініфікований код. Щоб завантажувати
source maps, додай у той самий Vercel-проєкт (Production):

- `SENTRY_AUTH_TOKEN`: Sentry → Settings → Auth Tokens → Create New Token (Organization token);
- `SENTRY_ORG`: slug організації (видно в URL `sentry.io/organizations/<slug>/`);
- `SENTRY_PROJECT`: `proiav`.

Публічно source maps не викладаються: після завантаження в Sentry вони видаляються зі збірки.

### 4. Перевірити після деплою

1. Відкрий <https://proiav.space/uk> → DevTools → Network: має бути запит на `…ingest…sentry.io`
   або `app.glitchtip.com` (це сесія, а не помилка).
2. Щоб побачити тестову помилку, у консолі браузера на сайті виконай
   `setTimeout(() => { throw new Error('sentry test ' + Date.now()) })`.
   Протягом хвилини вона з'явиться в Issues.
3. В Issues → подія → переконайся, що в ній немає email, cookie й параметрів посилань.
4. Налаштуй сповіщення: Sentry → Alerts (за замовчуванням лист на кожну нову помилку).
