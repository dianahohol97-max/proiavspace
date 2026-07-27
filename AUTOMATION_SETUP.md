# проЯв — ручні кроки для запуску автоматизації

Усе, що вимагає твого акаунта/токенів. Код і адмінка вже готові — це «вимикачі».

`MAKE_SECRET` (я згенерував): `0f7716d8f7619367916f9c9dc7098a5117c821bd84eb4aaa73d5b5dff4ebdef0`

---

## A. Змінні у Vercel
Vercel → proiavspace → Settings → Environment Variables → **Redeploy** після додавання.

| Змінна | Значення | Для чого |
|---|---|---|
| `MAKE_SECRET` | `0f7716d8…` (той самий) | Make ↔ наші роути |
| `THREADS_SEARCH_TOKEN` | Threads-токен **будь-якого** акаунта з пошуком | движок Threads |
| `MAKE_PUBLISH_HOOK_URL` | `https://hook.eu2.make.com/o5wdohs634b065nkcd21ns5ogsbpbbkc` | кнопка «Опублікувати зараз» |

`GEMINI_API_KEY` і `CRON_SECRET` уже додані.

---

## B. Instagram-постинг у Make
Сценарій **«проЯв — Постинг фото-постів (Instagram)»** (id 9540682). Переробити на нашу чергу:

1. **Прибрати** модуль Google Sheets (перший).
2. **HTTP → Make a request** (нове перше):
   - URL: `https://proiav.space/api/social/queue?format=single`
   - Method: `GET`
   - Headers: `Authorization: Bearer 0f7716d8…`
   - Parse response: **Yes**
3. **Filter** після нього: продовжити лише якщо є пост — умова `{{1.data.post.id}}` **Exists**.
4. **Instagram → Create a Photo Post** (лишити наявний):
   - Connection: твій Facebook → **Reauthorize** (дати доступ до сторінки/IG проЯв)
   - Account: обрати **проЯв** зі списку
   - Photo URL: `{{1.data.post.cover}}`
   - Caption: `{{1.data.post.caption}}`
5. **HTTP → Make a request** (позначити опублікованим):
   - URL: `https://proiav.space/api/social/posted`
   - Method: `POST`
   - Headers: `Authorization: Bearer 0f7716d8…`, `Content-Type: application/json`
   - Body (raw JSON): `{ "id": "{{1.data.post.id}}" }`
6. Розклад: кожну 1 годину. **Увімкнути.**

> Цей сценарій постить ОДНЕ фото (тизер «coming soon»). Для каруселей — окремий сценарій із модулем IG-каруселі (`format=carousel`), заведемо наступним.

---

## B2. Кнопка «Опублікувати зараз» (миттєвий постинг) — ГОТОВО
У прев'ю поста в адмінці дві кнопки:
- **Опублікувати зараз** — одразу пінгує Make-вебхук і постить без очікування розкладу.
- **Затвердити (у чергу)** — лишає для планового сценарію (розділ B).

Сценарій **«проЯв — Публікація зараз»** (id 9579491) **повністю зібраний і активований** мною:
**Custom webhook → HTTP (взяти пост із черги) → Router → Instagram** (карусель або одне фото) **→ HTTP «позначити опублікованим»**. Використовує твоє підключення **ADrian Facebook connection** і акаунт **@proiav.space** — той самий, що в наявних сценаріях.

**Лишився один твій крок:** додати `MAKE_PUBLISH_HOOK_URL` у Vercel (крок A) + Redeploy. Після цього «Опублікувати зараз» одразу постить у Instagram.

> Рілси поки йдуть окремим модулем — якщо захочеш публікувати й рілси цією кнопкою, скажи, додам гілку **Create a Reel post** (`{{2.data.post.video}}`). TikTok — через Buffer (розділ F), теж додам гілку в цей роутер за бажанням.
> Якщо перший постинг дасть помилку доступу — треба **Reauthorize** підключення ADrian Facebook (дати доступ до сторінки/IG проЯв). Це єдине, що я не можу зробити за тебе.

## C. Перший тест (пілот)
1. Адмінка → **Контент** → «Незабаром — проЯв» → **Переглянути** → **Затвердити**.
2. Make → сценарій IG → **Run once** → перевір, що з'явився пост у проЯв IG.

---

## D. Threads (пошук + ручні відповіді)
1. Додати `THREADS_SEARCH_TOKEN` у Vercel (крок A).
2. Пошук іде **щодня** автоматично (Vercel Cron). Для кожні 2–3 год — простий Make-сценарій:
   - **HTTP → Make a request**: `GET https://proiav.space/api/threads/scan`, Header `Authorization: Bearer 0f7716d8…`, розклад кожні 2–3 год.
3. Драфти з'являться в адмінці → **Threads** (тільки пости < 24 год).
4. Відповідаєш **вручну**: «Відкрити пост →» → вставити драфт у Threads.

---

## E. Пізніше
- **TikTok**: через Buffer (див. розділ F) — без заявки на TikTok API.
- **Pinterest**: пропущено.
- **Telegram-сповіщення**: бот @BotFather → токен + chat id → додам гілку сповіщень.

---

## F. TikTok через Buffer
TikTok постимо через Buffer (без заявки на TikTok API).

1. **Buffer** → Settings → Channels → **Connect a channel → TikTok** → акаунт проЯв (OAuth-клік).
2. Make-сценарій **«проЯв — TikTok через Buffer»**:
   - **HTTP GET** `https://proiav.space/api/social/queue?format=reel` (Header `Authorization: Bearer 0f7716d8…`, Parse: Yes)
   - **Filter**: `{{1.data.post.id}}` Exists
   - **Buffer → Create Update**: профіль = **TikTok проЯв**; media = `{{1.data.post.video}}` (для рілса) або `{{1.data.post.slides}}` (для каруселі); text = `{{1.data.post.caption}}`
   - **HTTP POST** `https://proiav.space/api/social/posted` — body `{ "id": "{{1.data.post.id}}" }`
   - Розклад: за твоїм ритмом. Увімкнути.

> **Бонус:** Buffer уміє також IG / Threads / Pinterest. За бажання можна вести кілька каналів **одним** Buffer-модулем (кілька profile_ids) замість окремих нативних сценаріїв.
