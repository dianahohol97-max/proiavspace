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
  return `Ти — україномовний контент-редактор бренду «проЯв» (proiav.space), SaaS для фотографів: клієнтські онлайн-галереї + персональні сайти + бронювання. Напиши ОДНУ SEO-статтю українською.

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
    slug: topic.slug,
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
