# CDN для прев'ю: Cloudflare Worker перед приватним бакетом B2

Галереї відкриваються повільно далеко від us-east: кожне прев'ю зараз іде напряму з бакета
Backblaze B2 підписаним посиланням, без кешу. Цей Worker стоїть між браузером і B2:

- віддає **лише варіанти** з `…/v/`: `preview`, `thumb`, `poster`
  (`u/<user>/g/<gallery>/v/<uuid>-preview.jpg`, а також `u/<user>/portfolio/v/…`);
- на **оригінали** (`…/o/…`), лого, відео для соцмереж і будь-що інше відповідає `404` і не звертається до B2;
- сам підписує запит до **приватного** бакета (S3 SigV4) ключем **лише на читання**;
- кешує відповідь у Cloudflare на 30 днів, а браузеру дає `max-age` на рік. Ключі містять
  UUID і ніколи не змінюються, тож застарілого кешу не буває;
- працює на адресі `https://proiav-media.<твій-піддомен>.workers.dev`, DNS з Namecheap переносити не треба.

Бакет **лишається приватним**. Застосунок нічого нового не робить: коли задано `MEDIA_CDN_URL`,
варіанти (`…/v/…`) отримують адресу Worker. Оригінали, лого й усе інше, як і раніше, отримують
підписані посилання на B2.

> **Як працює кеш на workers.dev.** Cache API (`caches.default`) на `*.workers.dev` не діє, тому
> Worker кешує свій підзапит до B2 (`fetch` з `cf.cacheEverything`). Щоб ключ кешу не мінявся,
> підпис «заморожено» на 6-денне вікно: шість днів URL до B2 той самий. Після перевірки
> (крок 6) у відповіді Worker є заголовок `X-Origin-Cache`: `HIT` означає, що фото прийшло з кешу
> Cloudflare, `MISS` означає, що з B2.

## Покрокова інструкція (≈ 20–30 хв)

### 1. Акаунт Cloudflare (безкоштовно)

1. Зареєструйся на <https://dash.cloudflare.com/sign-up> (email + пароль, підтвердити пошту).
   Домен додавати **не треба**.
2. У меню зліва **Compute (Workers) → Workers & Pages**. Cloudflare попросить вибрати піддомен
   `workers.dev`, наприклад `proiav`. Тоді адреса Worker буде `https://proiav-media.proiav.workers.dev`.
3. Тариф **Workers Free**: 100 000 запитів на добу. Кожне фото в сітці галереї рахується як один запит;
   повторні перегляди того самого браузера беруться з його кешу й запитів не створюють.
   Якщо колись упремося в ліміт, Workers Paid коштує $5 на місяць за 10 млн запитів.
   Поточну кількість видно на Workers & Pages → proiav-media → Metrics.

### 2. Ключ Backblaze лише на читання

1. <https://secure.backblaze.com> → **Application Keys → Add a New Application Key**.
2. Name of Key: `proiav-cdn-readonly`.
   Allow access to Bucket(s): **лише бакет медіа** (той самий, що `B2_BUCKET` у Vercel).
   Type of Access: **Read Only**. File name prefix: `u/`. Duration: порожньо.
3. **Create New Key**. Backblaze покаже `keyID` і `applicationKey` **один раз**: скопіюй обидва.
   Наявні ключі застосунку **не чіпай**.
4. Регіон бакета: Buckets → бакет → поле **Endpoint**, наприклад `s3.us-east-005.backblazeb2.com`.
   Регіон — це `us-east-005`. Те саме значення стоїть у Vercel у змінній `B2_REGION`.

### 3а. Деплой через wrangler (рекомендую: одна команда)

Потрібен Node.js на комп'ютері. У клоні репозиторію:

1. У `ops/cdn-worker/wrangler.toml` заміни `CHANGE-ME` на назву бакета (`B2_BUCKET`) і на регіон
   (`B2_REGION`). Це не секрети, їх можна закомітити.
2. Виконай:

   ```bash
   cd ops/cdn-worker
   ```

   ```bash
   npx wrangler@4 login
   ```

   ```bash
   npx wrangler@4 secret put B2_KEY_ID
   ```

   ```bash
   npx wrangler@4 secret put B2_APPLICATION_KEY
   ```

   ```bash
   npx wrangler@4 deploy
   ```

   `login` відкриє браузер для входу в Cloudflare. `secret put` попросить вставити значення
   `keyID` і `applicationKey` з кроку 2. Секрети зберігаються лише в Cloudflare, не в репозиторії.
   `deploy` надрукує адресу `https://proiav-media.<піддомен>.workers.dev`.

### 3б. Або через дашборд (без командного рядка)

1. Workers & Pages → **Create → Create Worker** → назва `proiav-media` → **Deploy**
   (з'явиться шаблон «Hello World»).
2. **Edit code**: заміни весь вміст на файл
   [`ops/cdn-worker/dist/worker.js`](dist/worker.js) (на GitHub кнопка **Raw** → виділити все →
   скопіювати). Далі **Deploy**.
3. **Settings → Variables and Secrets → Add**:
   - `B2_BUCKET`: Text, назва бакета;
   - `B2_REGION`: Text, наприклад `us-east-005`;
   - `EDGE_CACHE_SECONDS`: Text, `2592000`;
   - `B2_KEY_ID`: **Secret**, `keyID`;
   - `B2_APPLICATION_KEY`: **Secret**, `applicationKey`.

   Потім **Deploy**.

### 4. Перевірити Worker до того, як вмикати в застосунку

1. Візьми ключ будь-якого прев'ю. Supabase → SQL Editor:
   `select variants->>'preview' from assets where variants ? 'preview' limit 1;`
2. Відкрий `https://proiav-media.<піддомен>.workers.dev/<ключ>`: має показатись фото.
3. Заміни в ключі `/v/` на `/o/` (або візьми `r2_key` з тієї ж таблиці): має бути **404**.
4. Відкрий перше посилання ще раз і в DevTools → Network → Headers подивись `X-Origin-Cache`.
   З другого-третього разу там має бути `HIT`.

### 5. Увімкнути в застосунку

1. Vercel → проєкт **`dianatracker-dtks`** → Settings → Environment Variables.
2. `MEDIA_CDN_URL` = `https://proiav-media.<піддомен>.workers.dev` (без `/` у кінці),
   Environment: **Production** → Save.
3. Змінна серверна, тож діє з наступного деплою: мерж релізу або **Redeploy** останнього деплою.

### 6. Перевірити після деплою

- Відкрий публічну галерею в інкогніто → DevTools → Network → Img: адреси прев'ю
  `…workers.dev/u/…/v/…`, статус 200.
- Кнопка «Завантажити оригінал» і «Завантажити все» досі ведуть на `s3.<регіон>.backblazeb2.com`
  з `X-Amz-Signature`.
- Лого фотографа й обкладинки сайтів також лишаються на B2 (вони не у `/v/`).
- Worker → Metrics: запити йдуть, помилок (5xx) немає.

**Відкотити:** видалити `MEDIA_CDN_URL` у Vercel → Redeploy. Усе повертається до підписаних посилань B2.

## Що варто знати

- **Видалені галереї.** Прев'ю видаленої галереї ще до 30 днів може віддаватися з кешу Cloudflare
  тому, хто вже має пряме посилання (ключ містить UUID, вгадати його не можна). Хочеш коротше —
  зменш `EDGE_CACHE_SECONDS`.
- **Галереї з паролем.** Посилання на прев'ю потрапляє в браузер лише після введення пароля, але
  далі воно не має строку дії, як і раніше з будь-яким CDN. Оригінали ніколи не йдуть через Worker.
- **Ключ Worker** має доступ лише на читання й лише до одного бакета. Навіть якщо його вкрадуть,
  ним не можна нічого видалити чи завантажити.

## Розробка

- Код: `src/index.ts`, без залежностей (лише WebCrypto). `dist/worker.js` — та сама програма
  простим JS для дашборду; після змін перезбери її командою `node ops/cdn-worker/build.mjs`
  (тест перевіряє, що вона не відстала).
- Тести: `tests/audit-storage/cdn-worker.test.ts` (підпис звіряється з AWS SDK і з еталонним
  прикладом AWS). Вони запускаються в `npm run test:audit`.
- Локально: `npx wrangler@4 dev --var S3_ENDPOINT:http://127.0.0.1:8099 …` з фейковим B2.
