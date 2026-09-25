/**
 * In-app content engine: writes ONE blog article from the next queued topic
 * straight into Supabase as a DRAFT. Same logic as scripts/generate-article.mjs,
 * but callable from the dashboard (server action) so the founder never has to
 * touch GitHub. Nothing goes live until it is published in the admin.
 *
 * Server-only. Requires GEMINI_API_KEY in the environment; the Supabase admin
 * client already relies on NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import type { Block } from '@/lib/blog/articles'
import { slugifyUk } from '@/lib/seo/translit'
import { GALLERY_PLANS as P } from '@/lib/plans'

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'

export interface GenerateResult {
  ok: boolean
  /** Human-readable, Ukrainian — shown straight to the founder. */
  message: string
  articleId?: string
  title?: string
}

interface Topic {
  id: string
  slug: string
  title: string
  query: string
  angle: string
}

function isBlock(b: unknown): b is Block {
  if (!b || typeof b !== 'object') return false
  const block = b as Record<string, unknown>
  if (block.type === 'p' || block.type === 'h2') return typeof block.text === 'string'
  if (block.type === 'cta') return typeof block.text === 'string' && typeof block.href === 'string'
  if (block.type === 'ul')
    return Array.isArray(block.items) && block.items.every((i) => typeof i === 'string')
  return false
}

function buildPrompt(topic: Topic): string {
  return `Ти — україномовний контент-редактор бренду «проЯв» (proiav.space), SaaS для фотографів: клієнтські онлайн-галереї. Напиши ОДНУ SEO-статтю українською.

ФАКТИ ПРО ПРОДУКТ (згадуй природно, не рекламно; НЕ вигадуй інших функцій):
- Freemium: безкоштовно ${P.free.storageGb} ГБ назавжди, без картки; тарифи Базовий ${P.basic.priceUahMonth}₴/міс (${P.basic.storageGb} ГБ), Плюс ${P.plus.priceUahMonth}₴ (${P.plus.storageGb} ГБ), Максимальний ${P.pro.priceUahMonth}₴ (1 ТБ). Річна оплата = 2 місяці безкоштовно. Кількість галерей не обмежена.
- Клієнтські галереї: пароль і термін дії (на всіх тарифах), відбір фото сердечками без реєстрації клієнта, оригінали без стискання, zip одним кліком, слайдшоу, водяний знак з іменем на превʼю.
- Без підпису платформи й зі своїм логотипом — з Базового тарифу. Відео й статистика — на Плюс і Максимальному.
- Додатково: сторінка бронювання зйомки з оплатою напряму фотографу (Monobank, WayForPay, банка, реквізити).
- ЧОГО НЕМАЄ (не обіцяй): магазин друку, коментарі до фото, розділи в галереї, автоматичний лист клієнту, конструктор сайтів.

ТОН: на «ти», тепло, експертно, як досвідчений колега. Спершу користь, продукт — природно в контексті. Українською як носій (не калька). Без вигаданої статистики.

ТЕМА СТАТТІ:
- Заголовок (title): «${topic.title}»
- Цільовий пошуковий запит (природно в title і першому абзаці): «${topic.query}»
- Кут подачі: ${topic.angle}

ВИМОГИ: 800–1200 слів; 4–6 H2-підзаголовків; щонайменше один список; description — 140–160 символів; наприкінці РІВНО один заклик до дії (cta) на реєстрацію.
ВНУТРІШНІ ПОСИЛАННЯ: у тексті p або ul — щонайменше 2 посилання у форматі [анкор](/шлях), лише на ці сторінки: /uk/halerei (онлайн-галерея для фотографа), /uk/tsiny (тарифи), /uk/halereia-z-parolem (галерея з паролем), /uk/dlia-vesilnykh-fotohrafiv (для весільних фотографів), /uk/blog/yak-peredaty-foto-kliientu (як передати фото клієнту). Анкор — природна фраза, не «тут».

Поверни ЛИШЕ валідний JSON-об'єкт (без markdown, без пояснень):
{
  "title": "${topic.title}",
  "description": "…",
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
}

/**
 * Generate the next queued topic into a draft. Returns a result object (never
 * throws for expected conditions like an empty queue or a missing API key) so
 * the caller can surface a friendly message.
 */
export async function generateNextArticle(): Promise<GenerateResult> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return {
      ok: false,
      message: 'Ключ GEMINI_API_KEY не додано у Vercel. Додай його в змінні середовища й повтори.',
    }
  }
  const admin = createSupabaseAdminClient()
  if (!admin) return { ok: false, message: 'Service role не налаштований на сервері.' }

  // 1. next topic
  const { data: topics, error: topicErr } = await admin
    .from('blog_topics')
    .select('id, slug, title, query, angle')
    .eq('status', 'todo')
    .order('position', { ascending: true })
    .limit(1)
  if (topicErr) return { ok: false, message: `Не вдалося прочитати чергу тем: ${topicErr.message}` }
  const topic = (topics as Topic[] | null)?.[0]
  if (!topic) return { ok: false, message: 'Черга порожня — усі теми вже опрацьовані.' }

  // 2. generate
  let genRes: Response
  try {
    genRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(topic) }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.7 },
        }),
      }
    )
  } catch (error) {
    return { ok: false, message: `Не вдалося звʼязатися з Gemini: ${(error as Error).message}` }
  }
  if (!genRes.ok) {
    return { ok: false, message: `Gemini повернув помилку ${genRes.status}. Перевір ключ і квоту.` }
  }
  const genData = await genRes.json()
  const text: string =
    genData?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ??
    ''
  if (!text) return { ok: false, message: 'Порожня відповідь від Gemini. Спробуй ще раз.' }

  // 3. parse + validate
  let article: {
    title?: unknown
    description?: unknown
    readingMinutes?: unknown
    tags?: unknown
    body?: unknown
  }
  try {
    article = JSON.parse(
      text
        .replace(/^```json\s*/i, '')
        .replace(/```$/, '')
        .trim()
    )
  } catch {
    return { ok: false, message: 'Модель повернула некоректний JSON. Спробуй ще раз.' }
  }
  const body = article.body
  const valid =
    typeof article.title === 'string' &&
    typeof article.description === 'string' &&
    Array.isArray(article.tags) &&
    Array.isArray(body) &&
    body.length >= 4 &&
    body.every(isBlock) &&
    body.filter((b) => (b as Block).type === 'cta').length === 1
  if (!valid) return { ok: false, message: 'Стаття не пройшла перевірку структури. Спробуй ще раз.' }

  // 4. insert as draft (upsert on slug so a retry overwrites, never duplicates)
  const now = new Date()
  const row = {
    // Official transliteration (the topic queue still holds legacy slugs).
    slug: slugifyUk(topic.title, 70),
    title: article.title as string,
    description: String(article.description).slice(0, 300),
    published_date: now.toISOString().slice(0, 10),
    reading_minutes: typeof article.readingMinutes === 'number' ? article.readingMinutes : 5,
    tags: article.tags as string[],
    body,
    status: 'draft',
    source: 'ai',
    updated_at: now.toISOString(),
  }
  const { data: inserted, error: insErr } = await admin
    .from('blog_articles')
    .upsert(row, { onConflict: 'slug' })
    .select('id')
    .maybeSingle()
  if (insErr) return { ok: false, message: `Не вдалося зберегти чернетку: ${insErr.message}` }

  // 5. mark the topic done (best-effort — the draft already exists)
  await admin.from('blog_topics').update({ status: 'done' }).eq('id', topic.id)

  return {
    ok: true,
    message: `Готово — чернетку «${article.title as string}» створено. Переглянь і опублікуй нижче.`,
    articleId: (inserted as { id: string } | null)?.id,
    title: article.title as string,
  }
}
