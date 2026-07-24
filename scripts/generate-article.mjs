#!/usr/bin/env node
/**
 * Content engine: writes ONE blog article from the next queued topic straight
 * into Supabase as a DRAFT. Nothing goes live until you publish it in the
 * dashboard (Дашборд → Блог).
 *
 *   node scripts/generate-article.mjs
 *
 * Reads the next blog_topics row with status "todo", asks Gemini to write the
 * article (validated against the blog's Block schema), inserts it into
 * blog_articles as status "draft", and marks the topic done.
 *
 * Env:
 *   GEMINI_API_KEY               (required)
 *   SUPABASE_URL                 (or NEXT_PUBLIC_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY    (required)
 *   GEMINI_MODEL                 (optional, default "gemini-2.5-flash")
 */

const API_KEY = process.env.GEMINI_API_KEY
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function fail(message) {
  console.error(`✖ ${message}`)
  process.exit(1)
}

if (!API_KEY) fail('GEMINI_API_KEY is not set')
if (!SUPABASE_URL || !SERVICE_KEY) fail('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set')

const sb = (path, init = {}) =>
  fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })

/* ---- 1. next topic ---- */
const topicRes = await sb('blog_topics?status=eq.todo&order=position.asc&limit=1')
if (!topicRes.ok) fail(`Fetch topics ${topicRes.status}: ${await topicRes.text()}`)
const [topic] = await topicRes.json()
if (!topic) {
  console.log('No pending topics — nothing to do.')
  process.exit(0)
}

const today = new Date().toISOString().slice(0, 10)

const PROMPT = `Ти — україномовний контент-редактор бренду «проЯв» (proiav.space), SaaS для фотографів: клієнтські онлайн-галереї + персональні сайти + бронювання. Напиши ОДНУ SEO-статтю українською.

ФАКТИ ПРО ПРОДУКТ (згадуй природно, не рекламно):
- Freemium: безкоштовно 3 ГБ; тарифи Базовий 79₴/міс (100 ГБ), Плюс 319₴ (500 ГБ), Максимальний 559₴ (1 ТБ); сайти — окремий тариф. Річна оплата = 2 місяці безкоштовно.
- Клієнтські галереї: захист паролем, відбір/вподобайки клієнтом, завантаження оригіналів, водяний знак, термін дії.
- Оплати напряму фотографу (Monobank/картки). Нуль брендингу платформи на платних тарифах.
- Персональний сайт фотографа за вечір (власний домен, SEO). Бронювання зі слотами.

ТОН: на «ти», тепло, експертно, як досвідчений колега. Спершу користь, продукт — природно в контексті. Українською як носій (не калька). Без вигаданої статистики.

ТЕМА СТАТТІ:
- Заголовок (title): «${topic.title}»
- Цільовий пошуковий запит (природно в title і першому абзаці): «${topic.query}»
- Кут подачі: ${topic.angle}

ВИМОГИ: 550–850 слів; 3–5 H2-підзаголовків; щонайменше один список; наприкінці РІВНО один заклик до дії (cta) на реєстрацію.

Поверни ЛИШЕ валідний JSON-об'єкт (без markdown, без пояснень):
{
  "title": "${topic.title}",
  "description": "…",            // мета-опис до 155 символів
  "readingMinutes": 5,
  "tags": ["…","…"],
  "body": [
    {"type":"p","text":"…"},
    {"type":"h2","text":"…"},
    {"type":"ul","items":["…","…"]},
    {"type":"cta","text":"Спробувати проЯв безкоштовно","href":"/uk/login"}
  ]
}
Дозволені типи блоків: "p", "h2", "ul" (items[]), "cta" (text, href). Перший блок — "p". Останній — рівно один "cta".`

/* ---- 2. generate ---- */
const genRes = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: PROMPT }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.7 },
    }),
  }
)
if (!genRes.ok) fail(`Gemini API ${genRes.status}: ${(await genRes.text()).slice(0, 500)}`)
const genData = await genRes.json()
const text = genData?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? ''
if (!text) fail('Empty response from Gemini')

let article
try {
  article = JSON.parse(text.replace(/^```json\s*/i, '').replace(/```$/, '').trim())
} catch (error) {
  fail(`Model did not return valid JSON: ${error.message}\n---\n${text.slice(0, 400)}`)
}

/* ---- 3. validate ---- */
const isBlock = (b) =>
  b &&
  typeof b === 'object' &&
  ((b.type === 'p' && typeof b.text === 'string') ||
    (b.type === 'h2' && typeof b.text === 'string') ||
    (b.type === 'cta' && typeof b.text === 'string' && typeof b.href === 'string') ||
    (b.type === 'ul' && Array.isArray(b.items) && b.items.every((i) => typeof i === 'string')))

const valid =
  article &&
  typeof article.title === 'string' &&
  typeof article.description === 'string' &&
  Array.isArray(article.tags) &&
  Array.isArray(article.body) &&
  article.body.length >= 4 &&
  article.body.every(isBlock) &&
  article.body.filter((b) => b.type === 'cta').length === 1
if (!valid) fail('Generated article failed schema validation')

/* ---- 4. insert draft ---- */
const row = {
  slug: topic.slug,
  title: article.title,
  description: String(article.description).slice(0, 300),
  published_date: today,
  reading_minutes: typeof article.readingMinutes === 'number' ? article.readingMinutes : 5,
  tags: Array.isArray(article.tags) ? article.tags : [],
  body: article.body,
  status: 'draft',
  source: 'ai',
}
const insRes = await sb('blog_articles?on_conflict=slug', {
  method: 'POST',
  headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
  body: JSON.stringify(row),
})
if (!insRes.ok) fail(`Insert article ${insRes.status}: ${await insRes.text()}`)

/* ---- 5. mark topic done ---- */
const patchRes = await sb(`blog_topics?id=eq.${topic.id}`, {
  method: 'PATCH',
  headers: { Prefer: 'return=minimal' },
  body: JSON.stringify({ status: 'done' }),
})
if (!patchRes.ok) fail(`Mark topic done ${patchRes.status}: ${await patchRes.text()}`)

console.log(`✓ Draft created: "${article.title}" (topic: ${topic.query})`)
