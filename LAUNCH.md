# Чекліст запуску «проЯв»

Код повністю готовий. Нижче — рівно ті кроки, які потребують твоїх акаунтів
і рішень. Порядок має значення: без кроків 1–3 застосунок не запуститься,
кроки 4–7 вмикаються поступово.

## 1. Supabase (обов'язково)

1. Створи проєкт на supabase.com (регіон — Європа).
2. Застосуй міграції по черзі 0001 → 0010 (`supabase/migrations/`):
   локально `npx supabase link && npx supabase db push`, або встав вміст
   кожного файла в SQL Editor у дашборді.
3. Auth → URL Configuration → додай Redirect URLs:
   `https://proiav.space/auth/callback` (і `http://localhost:3000/auth/callback`).
4. Скопіюй: Project URL, anon key, service_role key (Settings → API).
5. Вхід через Google (кнопка вже на сторінці логіна):
   1. [Google Cloud Console](https://console.cloud.google.com) → створи проєкт →
      APIs & Services → OAuth consent screen (External, додай назву і домен).
   2. Credentials → Create Credentials → OAuth client ID → Web application.
      Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
      (точне значення показує Supabase на кроці 3 нижче).
   3. Supabase → Authentication → Sign In / Providers → Google → увімкни,
      встав Client ID і Client Secret.

## 2. Cloudflare R2 (обов'язково)

1. Створи bucket (наприклад `proyav-media`).
2. R2 → Manage API Tokens → токен з Object Read & Write на цей bucket.
3. Додай CORS-правило на bucket (Settings → CORS policy):

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://proiav.space"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["content-type"],
    "ExposeHeaders": ["etag"],
    "MaxAgeSeconds": 3600
  }
]
```

`etag` обов'язковий — без нього не працює multipart для великих відео.

## 3. Vercel + домен (обов'язково)

1. Задеплой репозиторій на Vercel (гілку злий у main або вкажи гілку).
2. Купи/підключи домен і встав env-змінні (Settings → Environment Variables):

| Змінна | Звідки |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API (секрет!) |
| `NEXT_PUBLIC_APP_URL` | `https://proiav.space` — від нього будується SEO і посилання |
| `GALLERY_UNLOCK_SECRET` | будь-який довгий випадковий рядок |
| `STORAGE_PROVIDER` | `r2` |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET` | Cloudflare R2 |

3. Прогін руками після деплою: реєстрація → створити галерею → завантажити
   фото → опублікувати → відкрити публічний лінк в інкогніто → сердечко →
   завантажити оригінал → архів.

## 4. SEO (одразу після деплою)

1. Google Search Console → додай домен → скопіюй код верифікації →
   env `GOOGLE_SITE_VERIFICATION` → redeploy → підтверди.
2. Надішли sitemap: `https://proiav.space/sitemap.xml`.

## 5. Оплати тарифів (коли готова брати гроші)

Два провайдери на вибір, перемикаються env-змінною `PAYMENT_PROVIDER`.
До налаштування сторінка тарифів чемно пише «оплати ще не підключені».

**Monobank-еквайринг (з авто-продовженням):**

1. Кабінет еквайрингу monobank → API → згенеруй токен.
2. Env: `PAYMENT_PROVIDER=monobank`, `MONOBANK_TOKEN`, а також
   `CRON_SECRET` — будь-який довгий випадковий рядок (ним Vercel Cron
   авторизується в `/api/billing/renew`).
3. Webhook налаштовується автоматично при створенні кожного рахунку —
   нічого прописувати в кабінеті не треба.
4. Як працює авто-продовження: при першій оплаті картка токенізується,
   щоденний cron списує оплату, коли період закінчився. Скасування — на
   сторінці тарифів (блок «Авто-продовження»); тариф діє до кінця
   оплаченого періоду, файли не видаляються. Якщо списання не пройшло —
   7 днів grace і позначка на сторінці тарифів, далі ліміти м'яко
   повертаються до безкоштовних.

**LiqPay (підписки з авто-продовженням):**

1. Зареєструй мерчанта LiqPay (ФОП), отримай public/private ключі.
2. Env: `PAYMENT_PROVIDER=liqpay`, `LIQPAY_PUBLIC_KEY`, `LIQPAY_PRIVATE_KEY`.
3. У кабінеті LiqPay вкажи server URL: `https://proiav.space/api/billing/webhook`.

## 6. Пошта для бронювань (опційно)

1. Акаунт brevo.com → Senders, Domains & Dedicated IPs → автентифікуй домен (DNS-записи Brevo) → SMTP & API → API key.
2. Env: `BREVO_API_KEY`, `EMAIL_FROM` (наприклад `проЯв <booking@домен>`).
   Перевірка: `POST /api/admin/test-email` з `{"to": "твоя@пошта"}` (під адмін-акаунтом).
   Без цього броні працюють, просто без листів — усе видно в кабінеті.

## 7. Пізніше, коли виростеш

- **B2 для важких тарифів**: bucket на Backblaze + env `B2_*`,
  перемикання `STORAGE_PROVIDER=b2` (код готовий).
- **Bunny Stream** для відео-транскодингу.
- **Блог** для SEO-трафіку — під нього закладемо структуру окремо.

## Що вже вирішено і НЕ потребує твоїх дій

Схема БД з RLS (10 міграцій), три продукти (галереї зі стилями і watermark,
конструктор сайтів з портфоліо і живим прев'ю, бронювання з оплатами напряму
та автоматизаціями), тарифи v2 з фіче-гейтами і grace-періодом, бандл −15%,
брендинг «проЯв», лендинг, SEO-шар, чайові. Ціни міняються в одному файлі —
`src/lib/plans.ts`.
