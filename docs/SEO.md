# SEO proiav.space — що зроблено, що потрібно від тебе, що перевірити

Гілка: `claude/proiav-seo-audit-buavwk`. Усі правки стосуються лише публічних сторінок, метаданих, контенту й SEO-конфігу. Кабінет, клієнтські галереї й білінг не змінювались.

---

## 1. Що зроблено

### Етап 1 — технічна база
| Що | Де |
|---|---|
| Одна функція метаданих: title / description / canonical / hreflang / OG / Twitter (twitter:* = og:* цієї сторінки). `meta keywords` прибрано | `src/lib/seo/metadata.ts` |
| Canonical вказує на саму сторінку. `pl/de/es/fr/it/ro/pt` на маркетингових сторінках мають `noindex,follow` і не потрапляють у hreflang та sitemap. Клієнтські галереї цими мовами працюють як раніше | `metadata.ts`, `[locale]/layout.tsx` |
| hreflang `uk` / `en` / `x-default → /uk` для головної, демо, оферти й політики | `metadata.ts` |
| `robots.txt`: закриті `/api/`, `/auth/`, `/{мова}/dashboard`, `/login`, `/site-preview` для всіх 9 мов. `/g` і `/b` відкриті навмисно: на них стоїть meta noindex, і Google має його побачити | `src/app/robots.ts` |
| `sitemap.xml`: усі індексовані сторінки, `xhtml:link` hreflang, `lastmod` для статей і тем, `<image:image>`, сайти фотографів `/uk/s/…`. Приватних галерей і бронювань там немає | `src/app/sitemap.xml/route.ts` |
| JSON-LD: Organization + WebSite на кожній маркетинговій сторінці; SoftwareApplication з тарифами з `plans.ts` (головна, `/uk/tsiny`); FAQPage (головна, продуктові сторінки, статті з FAQ); BlogPosting (dateModified); BreadcrumbList (усі внутрішні); CollectionPage (теми блогу) | `src/lib/seo/structured-data.ts` |
| Динамічні OG-картинки з заголовком сторінки: `/og/page.{id}.png`, `/og/blog.{slug}.png`, `/og/tema.{slug}.png` | `src/app/og/[key]/route.tsx` |
| Єдина транслітерація для нових слагів (КМУ 2010: галерея → halereia, фотограф → fotohraf, прояв → proiav) | `src/lib/seo/translit.ts` |
| Старі слаги статей → 301 на нові (14 статей), таблиця редиректів | `src/lib/blog/legacy-slugs.json`, `next.config.js` |
| Фото головної й демо у WebP: 10,9 МБ → 3,5 МБ. Змістовні alt у демо-галереї. Preload шрифтів на маркетингових сторінках | `public/showcase`, `public/themes`, `src/lib/seo/fonts.ts` |
| Бренд «проЯв» уніфіковано в title, футері, копірайті, manifest і `llms.txt` | — |

### Етап 2 — продуктові сторінки
| URL | Статус | Слів |
|---|---|---|
| `/uk/halerei` — Онлайн-галерея для фотографа | index | ~790 |
| `/uk/tsiny` — Тарифи (таблиця з `plans.ts`) | index | ~650 |
| `/uk/halereia-z-parolem` | index | ~620 |
| `/uk/dlia-vesilnykh-fotohrafiv` | index | ~610 |
| `/uk/porivniannia` — хаб порівнянь | index | ~160 |
| `/uk/porivniannia/pixieset`, `/pic-time`, `/pixover`, `/gallery4you` | **noindex (чернетки)** | 300–440 |

Кожна фіча проЯв на цих сторінках перевірена по коду. Чесний блок «Чого в проЯв поки немає» написаний так само.
Меню веде на реальні сторінки замість `#galleries` / `#pricing`. Головна: підзаголовок із ключем під H1, H2 з ключами. Секцію «Сайти для фотографів — Скоро» і картку «Сайти» прибрано. Картку «Теми сайту» замінено на реальні опції дизайну галереї. Бронювання на лендінгу лишилось (як ти вирішила), але з title і description його прибрано.

### Етап 3 — блог
- 5 ключових статей розширено до 1190–1250 слів. У кожній: H2/H3 під підзапити, таблиця, FAQ з FAQPage-розміткою, 2–3 зображення (реальні скриншоти демо-галереї + брифи для решти), посилання на продуктові сторінки й між статтями. `dateModified` = 2026-09-24, дата оновлення видна на сторінці.
- Теми блогу як окремі індексовані сторінки: `/uk/blog/tema/halerei`, `robota-z-kliientamy`, `tsiny-i-oplaty`, `prosuvannia`, `zberihannia-foto`.
- «Читати далі» підбирає 3 статті за спільними тегами й темами, а не просто найновіші.
- Якщо в статті менше 2 посилань на продуктові сторінки, під час рендеру додається контекстний абзац за темою. Вміст у базі не змінюється.
- Промпт AI-генератора статей виправлено: правдиві факти про продукт (без конструктора сайтів, магазину друку, листа клієнту), description 140–160, обовʼязкові внутрішні посилання. Нові слаги генеруються за офіційною транслітерацією.

### Етап 4 — індексація
- Мета-теги верифікації Google і Bing через env. IndexNow-ключ віддається за адресою `/indexnow-key.txt`.
- `npm run seo:submit` надсилає всі URL із sitemap в IndexNow (Bing та інші), sitemap у Google Search Console і, з прапорцем `--inspect`, показує статус індексації ключових сторінок.

---

## 2. Аудит блогу (15 статей)

«Продукт. посилання» — посилання на `/uk/halerei`, `/uk/tsiny` та інші продуктові сторінки (вже з урахуванням автоабзацу).

| Стаття (новий слаг) | Джерело | Опубл. | Слів до → після | H2 | Продукт. посилання | Зображення | Description |
|---|---|---|---|---|---|---|---|
| naikrashchi-servisy-halerei-dlia-fotohrafiv | код | 27.07 | 527 → 1210 | 14 | 3 | 1 скрин + 1 бриф | 150 ✓ |
| yak-peredaty-foto-kliientu | код | 24.07 | 503 → 1213 | 15 | 5 | 1 скрин + 1 бриф | 160 ✓ |
| halereia-dlia-fotohrafa | код | 21.07 | 466 → 1247 | 10 | 5 | 2 скрини + 1 бриф | 149 ✓ |
| proiav-vs-pixieset-pic-time | код | 17.07 | 474 → 1188 | 14 | 2 | 1 скрин + 1 бриф | 147 ✓ |
| skilky-koshtuie-zberihaty-foto | код | 14.07 | 525 → 1210 | 11 | 3 | 2 брифи | 157 ✓ |
| ~~sait-fotohrafa-za-vechir~~ | — | 10.07 | — | — | — | — | 308 → portfolio-fotohrafa-yak-zibraty (§3) |
| yak-pryimaty-oplatu-za-foto | код | 07.07 | 480 | 5 | 3 | 0 | 151 ✓ |
| yak-vstanovyty-tsinu-na-fotosesiiu | БД (AI) | 23.07 | 532 | 5 | 2 (авто) | 0 | 118 ✗ |
| dohovir-z-kliientom-dlia-fotohrafa | БД (AI) | 22.07 | 425 | 5 | 2 (авто) | 0 | 140 ✓ |
| yak-znaity-pershykh-kliientiv-fotohrafu | БД (AI) | 20.07 | 429 | 5 | 2 (авто) | 0 | 127 ✗ |
| peredoplata-za-fotosesiiu | БД (AI) | 19.07 | 362 | 4 | 2 (авто) | 0 | 133 ✗ |
| rezervne-kopiiuvannia-fotohrafii | БД (AI) | 16.07 | 435 | 5 | 2 (авто) | 0 | 124 ✗ |
| instagram-dlia-fotohrafa | БД (AI) | 15.07 | 392 | 4 | 2 (авто) | 0 | 122 ✗ |
| yak-vidbyraty-foto-pislia-ziomky | БД (AI) | 13.07 | 403 | 4 | 2 (авто) | 0 | 121 ✗ |
| portfolio-fotohrafa-yak-zibraty | БД (AI) | 12.07 | 359 | 4 | 2 (авто) | 0 | 127 ✗ |

Висновки: 8 AI-статей із бази короткі (360–530 слів), без зображень, і в 7 із них description коротший за 140. Поки їх не розширено, сторінки робочі, але слабкі. Це кандидати на наступну хвилю розширення: найперше `yak-vidbyraty-foto-pislia-ziomky` і `rezervne-kopiiuvannia-fotohrafii`, бо вони найближчі до продукту.

---

## 3. Відкриті питання та рішення

Відкрите:
1. **Сторінки порівнянь** (`/uk/porivniannia/*`) лишаються noindex, доки ти не надішлеш факти про конкурентів. На сторінках вони підсвічені червоним `[УТОЧНИТИ]`.
   - Pixieset і Pic-Time: безкоштовний план (обсяг і обмеження), актуальні ціни, чи проходить оплата українською карткою, чи є відбір, пароль, відео, статистика, власний домен, чи локалізована клієнтська галерея.
   - Pixover і Gallery4you: мова, функції, тарифи, спосіб оплати, у чому вони сильніші.
   - Дата перевірки даних.
   - Щоб опублікувати сторінку: прибрати `draft: true` у `src/lib/landing/product-pages.ts`.
2. **Бейдж у клієнтських галереях** «Створено на «Прояві»» (`uk.ts → madeOn`) уже веде на головну. Чи міняти текст на «Створено на проЯв» і посилання — на `/uk/halerei`?
3. **8 коротких AI-статей** — повертаємось через 2–3 тижні за даними Search Console і розширюємо ті, що отримують покази.

Вирішено:
- **Цифра на головній** — «30 000+» (реальна). У JSON-LD і на OG-картинках вона не дублюється.
- **Автор статей — Ева Худюк.** Сторінка `/uk/autor/eva-khudiuk`: імʼя, біо, місце під фото (поки ініціали), список статей. У кожній статті є підпис із посиланням на сторінку. У JSON-LD `author` — Person з `url` на цю сторінку, без sameAs; на самій сторінці розмітка ProfilePage. Щоб додати фото: поклади файл у `public/authors/` і вкажи `photo` в `src/lib/blog/authors.ts`, там само редагується біо.
- **Соцмережі бренду.** У Organization поки немає sameAs. Коли акаунти зʼявляться, достатньо додати URL у масив `BRAND_PROFILES` у `src/lib/seo/site.ts`.
- **Стаття `sait-fotohrafa-za-vechir`** віддає 308 на `/uk/blog/portfolio-fotohrafa-yak-zibraty` (старий слаг `sajt-fotografa-za-vechir` веде туди ж напряму, без ланцюжка). Вона прибрана з блогу, sitemap і «Читати далі». Чому портфоліо, а не `/uk/halerei`: людина, яка шукала «сайт фотографа», хоче показати свої роботи й отримувати клієнтів — це інтент статті про портфоліо. Сторінка галерей відповідає на інше питання (як віддати зйомку). Редирект на нерелевантну сторінку Google часто вважає «soft 404» і не передає їй вагу.
- **Обіцянки конструктора сайтів у статтях із БД** (2026-09-25). У `portfolio-fotohrafa-yak-zibraty`, `instagram-dlia-fotohrafa` і `yak-znaity-pershykh-kliientiv-fotohrafu` фінальний абзац переписано: замість «сайту за вечір» тепер реальні можливості — галерея без пароля як портфоліо за посиланням у біо, відбір і передача фото клієнту. Оновлено лише `body` (один абзац) і `updated_at`. Бекап до змін: `docs/backup/blog_articles-2026-09-25-before-site-claims-fix.json`, звірений з БД за md5 кожного блоку. dateModified для статей із БД береться з `updated_at`, якщо рядок редагували після створення.
- **Нові ціни тарифів** (2026-09-25): Базовий 129 ₴/міс (1290 ₴/рік), Плюс 519/5190, Максимальний 899/8990. Усі ціни в коді беруться з `src/lib/plans.ts`: `llms.txt` тепер генерується маршрутом `src/app/llms.txt/route.ts`, промпт генератора статей v2 (`src/lib/blog/generator/prompts.ts`) бере ціни з `plans.ts`, промпт відповідей у Threads (`src/lib/threads/scan.ts`) бере їх із `GALLERY_PLANS`. Статті в `blog_articles` цін проЯв не містили. Пʼять неопублікованих чернеток у `social_posts`, `threads_replies`, `social_topics` зі старою ціною 79 грн: бекап `docs/backup/social-drafts-2026-09-25-before-reprice.json` (md5 кожного рядка), правка — `docs/backup/social-drafts-2026-09-25-reprice.sql`, застосовується після мерджу й деплою.
- **Пошук «сайт / конструктор / домен / за вечір / з готових блоків» по всіх 15 статтях** (код + БД): обіцянок конструктора в проЯв більше немає. Решта згадок — загальні поради про власний сайт. Один пункт варто переглянути: у `yak-pryimaty-oplatu-za-foto` в переліку способів оплати є «Оплата прямо в галереї чи на сайті…». Це загальний опис, але в проЯв оплати в галереї немає.
- **OG-картинка головної.** Статична `og.png` містила «Галереї · Сайти · Бронювання», тому головна й сторінки-фолбеки тепер використовують згенеровану картку `/og/page.home.png` («Онлайн-галерея для фотографа»). Файл `og.png` лишився в репозиторії, але ніде не використовується.
- **Ціни.** Головна, `/uk/tsiny`, статті й промпт AI-генератора беруть ціни з `src/lib/plans.ts`. JSON-LD Offer і видимий текст збігаються (перевірено скриптом).

---

## 4. Core Web Vitals — що впливає

Заміри локально, Chromium, 4× CPU throttling, ~1,6 Мбіт/с:

| Сторінка | LCP-елемент | LCP | CLS | JS (First Load, gzip) |
|---|---|---|---|---|
| `/uk` (моб.) | текст lede | ~1,0 с | 0,007 | 167 КБ |
| `/uk` (десктоп) | H1 | ~0,9 с | 0,007 | 167 КБ |
| `/uk/halerei` | текст lede | ~0,7 с | 0 | 96 КБ |
| стаття блогу | перший абзац | ~0,7 с | 0 | 96 КБ |

LCP на всіх сторінках — це текст, тож демо-галерея й слайдшоу його не блокують. Що варто знати:
1. **Головна +70 КБ JS** через `AuthNav`: клієнт Supabase вантажиться, щоб показати «Кабінет» замість «Увійти». Можна вантажити його ліниво після `requestIdleCallback` або перевіряти cookie сесії без SDK. Це зміна логіки авторизації, тому я її не робила.
2. **Фото-стрічка та бенто на головній** — CSS `background-image`, 16 фото (~740 КБ WebP) вантажаться одразу, навіть ті, що нижче першого екрана. Можна перевести нижні блоки на `<img loading="lazy">` або підключати фон, коли блок зʼявляється в полі зору.
3. **Анімація `Reveal`** ховає секції до скролу (opacity). Для Google це не проблема (він рендерить високий viewport), але на повільних телефонах контент зʼявляється із затримкою.
4. **Шрифти**: self-hosted woff2, `font-display: swap`, preload кириличного субсету на маркетингових сторінках. Гаразд.
5. **Зображення**: `next/image` вимкнено навмисно (R2 без оптимізатора). У нових `<img>` є `width` / `height` / `loading="lazy"` / `decoding="async"`. Коли підключите image-CDN (`src/lib/images/loader.ts`), можна вмикати avif.
6. **Скрипт телеметрії помилок** в `layout.tsx` — інлайн, крихітний. На CWV не впливає.

---

## 5. Контент-план на 12 тижнів (1 стаття / тиждень)

| Тиждень | Тема | Цільовий запит | Куди вести посилання |
|---|---|---|---|
| 1 | Чим замінити Google Drive для передачі фото клієнту | передати фото клієнту | /uk/halerei |
| 2 | Як зробити галерею з паролем для клієнта: покроково | галерея фотографій з паролем | /uk/halereia-z-parolem |
| 3 | Клієнтська галерея: що це і як вона працює для фотографа | клієнтська галерея | /uk/halerei |
| 4 | Як весільному фотографу віддати зйомку без 50 питань від пари | галерея для весільного фотографа | /uk/dlia-vesilnykh-fotohrafiv |
| 5 | Як віддати фото клієнту після зйомки: чек-лист на 10 хвилин | як віддати фото клієнту після зйомки | /uk/halerei |
| 6 | Аналог Pixieset українською: що перевірити перед переходом | аналог Pixieset українською | /uk/porivniannia/pixieset* |
| 7 | Превʼю наступного дня: sneak peek після весілля | галерея для весільного фотографа | /uk/dlia-vesilnykh-fotohrafiv |
| 8 | Як клієнту обрати фото на ретуш: інструкція, яку можна переслати | відбір фото клієнтом | /uk/halerei |
| 9 | Pic-Time чи українська галерея: коли продаж друку вартий долара | Pic-Time альтернатива | /uk/porivniannia/pic-time* |
| 10 | Скільки тримати фото клієнта онлайн і що прописати в договорі | термін зберігання фото клієнта | /uk/halereia-z-parolem |
| 11 | Сервіси галерей для фотографів в Україні: огляд | сервіс галерей для фотографів | /uk/porivniannia |
| 12 | Як передати фото клієнту за кордон у повній якості | передати фото клієнту | /uk/halerei |

\* Тижні 6, 9 і 11 — після того, як факти про конкурентів підтверджено (§3). Частина тем уже є в черзі `blog_topics` (`chym-zaminyty-google-drive`, `galereya-z-parolem-yak`, `galereyi-dlya-fotografa-porivnyannya`), тож їх можна просто підняти вище в черзі.

---

## 6. Індексація — що вставити і що натиснути

### 6.1. Змінні в Vercel (Project → Settings → Environment Variables → Production)
| Змінна | Значення |
|---|---|
| `NEXT_PUBLIC_APP_URL` | **перевір**, що це точно `https://proiav.space` (без www і без слеша в кінці). Від нього будуються всі canonical, hreflang і sitemap |
| `GOOGLE_SITE_VERIFICATION` | з GSC: лише значення `content="…"` мета-тегу |
| `BING_SITE_VERIFICATION` | з Bing Webmaster: значення `content` тегу `msvalidate.01` |
| `INDEXNOW_KEY` | будь-які 32 hex-символи, напр. `openssl rand -hex 16` |

Після зміни env зроби redeploy.

### 6.2. Google Search Console
1. search.google.com/search-console → «Додати ресурс».
2. Найкраще — **Доменний ресурс** `proiav.space`: підтвердження TXT-записом у DNS (там, де керуєш доменом). Він покриває і www, і http/https. Якщо DNS недоступний — «Префікс URL» `https://proiav.space/` → «Тег HTML» → скопіюй значення `content` у `GOOGLE_SITE_VERIFICATION` → redeploy → «Підтвердити».
3. «Файли Sitemap» → введи `sitemap.xml` → «Надіслати».
4. «Перевірка URL» → по черзі встав: `https://proiav.space/uk`, `/uk/halerei`, `/uk/tsiny`, `/uk/halereia-z-parolem`, `/uk/dlia-vesilnykh-fotohrafiv`, `/uk/blog`, `/uk/blog/yak-peredaty-foto-kliientu`, `/uk/blog/halereia-dlia-fotohrafa` → «Надіслати запит на індексування». Ліміт — близько 10 на день, тож пріоритет саме такий.
5. Через 3–7 днів: «Сторінки» (покриття) і «Покращення» (FAQ, Breadcrumbs).

Indexing API від Google — лише для вакансій і трансляцій, для звичайних сторінок його використовувати не можна. URL Inspection API тільки читає статус і не надсилає запит на індексацію. Для Google достатньо sitemap і кнопки «Надіслати запит».

### 6.3. Bing Webmaster Tools
bing.com/webmasters → «Import from Google Search Console» (найшвидше; підтягне ресурс і sitemap). Або вручну: додати сайт → мета-тег у `BING_SITE_VERIFICATION` → sitemap. IndexNow від Bing підхоплює одразу.

### 6.4. Скрипт після кожного деплою
```bash
INDEXNOW_KEY=… npm run seo:submit
# з Google (service account, доданий власником ресурсу в GSC):
INDEXNOW_KEY=… GOOGLE_SA_JSON=./sa.json npm run seo:submit -- --inspect
```

---

## 7. Перші беклінки (без спаму)

1. **Власні профілі бренду**: Instagram, Threads, Telegram-канал, Facebook, LinkedIn company page — посилання на `/uk` у біо. Додай їх у `BRAND_PROFILES` (`src/lib/seo/site.ts`).
2. **Каталоги SaaS**: AlternativeTo (додай проЯв як альтернативу до Pixieset і Pic-Time), Product Hunt (лонч англійської версії), Crunchbase.
3. **Україномовні спільноти фотографів** (Facebook-групи, Telegram-чати): не реклама, а корисні пости, наприклад «шаблон повідомлення клієнту з фото» з посиланням на статтю.
4. **Tech-медіа**: колонка на DOU від спільноти («як ми робили сервіс галерей для фотографів») — розповідь про розробку, а не реклама.
5. **Фотошколи й курси**: безкоштовний акаунт чи знижка для студентів в обмін на посилання в матеріалах курсу.
6. **Орендні фотостудії й прокати техніки**: розділ «корисні сервіси для фотографів» на їхніх сайтах.
7. **Реферали**: попроси активних фотографів-користувачів згадати проЯв на своїх сайтах (сторінка «як я віддаю фото»).
8. **Бейдж у безкоштовних галереях** уже веде на головну. SEO-ваги він не має, бо галереї nofollow, але це реферальний трафік: можна вести його на `/uk/halerei` з UTM, щоб бачити конверсію (див. §3).
9. **YouTube / Reels**: 60-секундне відео «як передати фото клієнту» з посиланням на статтю.

---

## 8. Зображення, які треба зробити (брифи)

На проді брифи приховані. Щоб побачити їх на живому сайті, увімкни `NEXT_PUBLIC_SHOW_IMAGE_BRIEFS=1` у Preview-оточенні. Коли зображення готове, поклади файл у `public/blog/` і додай `src`, `width`, `height` до блоку `img`.

| Стаття / сторінка | Бриф (alt) |
|---|---|
| halereia-dlia-fotohrafa | Порівняння трьох розкладок однієї зйомки поруч: мозаїка, квадрати і едіторіал |
| yak-peredaty-foto-kliientu | Кабінет фотографа: форма нової галереї з полями «Назва», «Пароль», «Термін дії» і кнопкою копіювання посилання |
| naikrashchi-servisy-halerei-dlia-fotohrafiv | Порівняльна інфографіка: чотири картки сервісів з позначками мови, валюти і магазину друку |
| proiav-vs-pixieset-pic-time | Схема переїзду між сервісами: нові зйомки йдуть у новий сервіс, старі галереї доживають термін дії |
| skilky-koshtuie-zberihaty-foto | Діаграма: робочий RAW-архів на дисках і в бекапі окремо від фінальної віддачі в галереях |
| skilky-koshtuie-zberihaty-foto | Кабінет: шкала використаного місця і список галерей із розміром кожної |
| /uk/halereia-z-parolem | Екран введення пароля клієнтської галереї: назва зйомки, поле «Пароль», кнопка «Відкрити», перемикач мови |

---

## 9. Чекліст

### Зроблено
- [x] robots.txt, sitemap.xml (hreflang, lastmod, images), canonical на саму сторінку, hreflang + x-default
- [x] noindex,follow для pl/de/es/fr/it/ro/pt (маркетинг)
- [x] Єдина функція метаданих, twitter = og, без keywords, title ≤ 60, description 140–160
- [x] JSON-LD: Organization, WebSite, SoftwareApplication + offers, FAQPage, BlogPosting, BreadcrumbList, CollectionPage
- [x] Динамічні OG-картинки, WebP, alt, preload шрифтів
- [x] Транслітерація КМУ-2010, 301 зі старих слагів
- [x] 4 продуктові сторінки + хаб порівнянь (index), 4 порівняння (чернетки)
- [x] Меню і футер ведуть на реальні сторінки; головна без «Сайтів — Скоро»
- [x] 5 статей по 1190–1250 слів, теми блогу, «Читати далі» за тегами, dateModified
- [x] Верифікація Google/Bing через env, IndexNow, `npm run seo:submit`

### Потрібно від тебе
- [ ] Факти про конкурентів (§3) → зняти `draft` з порівнянь
- [ ] Фото й фінальне біо Еви (`src/lib/blog/authors.ts`)
- [ ] Зображення за брифами (§8)
- [ ] Через 2–3 тижні: дані GSC → розширення AI-статей з показами

### Перевірити після деплою
- [ ] `https://proiav.space/robots.txt` і `https://proiav.space/sitemap.xml` відкриваються; у sitemap є 8 статей із БД і теми блогу
- [ ] Див. «Після мерджу» нижче
- [ ] `https://proiav.space/og/page.halerei.png` віддає картинку
- [ ] Rich Results Test (search.google.com/test/rich-results) для `/uk`, `/uk/tsiny`, `/uk/blog/halereia-dlia-fotohrafa` — без помилок
- [ ] `view-source:` на `/pl` → `noindex, follow`; на `/uk` → `index, follow` і canonical `https://proiav.space/uk`
- [ ] Поділитися посиланням на статтю в Telegram — превʼю з OG-картинкою статті
- [ ] Через тиждень: GSC → «Сторінки» → скільки проіндексовано; «Покращення» → FAQ / Breadcrumbs

---

## 10. Після мерджу — чекліст для тебе

1. **Змінні у Vercel** (Production), §6.1:
   - [ ] `NEXT_PUBLIC_APP_URL` = `https://proiav.space` (без www і без `/` в кінці)
   - [ ] `GOOGLE_SITE_VERIFICATION`
   - [ ] `BING_SITE_VERIFICATION`
   - [ ] `INDEXNOW_KEY`
2. [ ] **Redeploy** Production. Змінні `NEXT_PUBLIC_*` потрапляють у код під час збірки, тому після їх зміни потрібна нова збірка.
3. **Швидка перевірка проду:**
   - [ ] `https://proiav.space/robots.txt` відкривається, у кінці `Sitemap: https://proiav.space/sitemap.xml`
   - [ ] `https://proiav.space/sitemap.xml` містить 8 статей із БД з новими слагами, теми блогу й `/uk/autor/eva-khudiuk`; у ньому немає `sait-fotohrafa-za-vechir`
   - [ ] `view-source:https://proiav.space/uk` → canonical `https://proiav.space/uk`, `index, follow`, тег `google-site-verification`
4. **Search Console:**
   - [ ] «Підтвердити» ресурс
   - [ ] «Файли Sitemap» → `sitemap.xml` → «Надіслати»
5. **Ручна індексація** («Перевірка URL» → «Надіслати запит на індексування»), до ~10 на день:
   - [ ] https://proiav.space/uk
   - [ ] https://proiav.space/uk/halerei
   - [ ] https://proiav.space/uk/tsiny
   - [ ] https://proiav.space/uk/halereia-z-parolem
   - [ ] https://proiav.space/uk/dlia-vesilnykh-fotohrafiv
   - [ ] https://proiav.space/uk/blog
   - [ ] https://proiav.space/uk/blog/yak-peredaty-foto-kliientu
   - [ ] https://proiav.space/uk/blog/halereia-dlia-fotohrafa
6. **Редиректи статей із БД** — кожен має дати 308 на новий слаг, а новий слаг — 200:
   ```bash
   for s in portfolio-fotografa-yak-zibraty yak-vidbyraty-foto-pislya-zjomky instagram-dlya-fotografa \
            backup-fotografij-fotograf peredoplata-za-fotosesiyu yak-znajty-pershyh-kliyentiv-fotograf \
            dogovir-z-kliyentom-fotograf yak-vybraty-cinu-na-fotosesiyu; do
     curl -sIL -o /dev/null -w "%{http_code} %{url_effective}\n" https://proiav.space/uk/blog/$s
   done
   ```
   - [ ] Усі 8 рядків: `200 https://proiav.space/uk/blog/<новий-слаг>`
7. [ ] **Bing**: Webmaster Tools → «Import from Google Search Console».
8. [ ] (опційно) `INDEXNOW_KEY=… npm run seo:submit`
9. [ ] **Rich Results Test** для `/uk`, `/uk/tsiny`, `/uk/blog/halereia-dlia-fotohrafa`: без помилок, видно FAQ, Breadcrumbs, Article з автором.
