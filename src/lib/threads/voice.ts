/**
 * The проЯв Threads voice: drafting helpers for the founder's own feed posts
 * and comments under other people's posts (incl. trending posts that have
 * nothing to do with photography — the voice carries, the product pitch only
 * appears when it is natural).
 */

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'

export const BRAND_VOICE =
  `Ти — голос українського бренду проЯв (проЯв.space) — онлайн-галереї, якими фотографи ` +
  `віддають зйомки клієнтам. Голос бренду: жива розмовна українська, тепло і впевнено, ` +
  `з легкою дотепністю; коротко, як пишуть у Threads. Без корпоративщини, без кліше, ` +
  `без хештегів, без емодзі-спаму (максимум один доречний емодзі). ` +
  `ВАЖЛИВО: проЯв чи фотографію згадуй ЛИШЕ коли це природно в контексті. ` +
  `Якщо тема не про фото — просто підтримай розмову по-людськи, дотепно і в голосі бренду.`

interface GeminiPart {
  text?: string
  inline_data?: { mime_type: string; data: string }
}

async function gemini(apiKey: string, parts: GeminiPart[], temperature = 0.9): Promise<string | null> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature } }),
      }
    )
    if (!res.ok) return null
    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text
    return typeof text === 'string' && text.trim() ? text.trim() : null
  } catch {
    return null
  }
}

/** Draft a post for проЯв's own Threads feed from the founder's idea/topic. */
export async function composeOwnPost(apiKey: string, idea: string): Promise<string | null> {
  const prompt =
    `${BRAND_VOICE}\n\n` +
    `Напиши ОДИН пост для стрічки Threads від проЯв на цю тему/ідею:\n"${idea}"\n\n` +
    `Вимоги: 1–4 короткі речення (або 2–3 рядки), гачок з першого рядка, природна кінцівка ` +
    `(питання до авдиторії або тепла крапка — за змістом). Без лапок навколо тексту, ` +
    `без хештегів. Поверни ЛИШЕ текст поста.`
  return gemini(apiKey, [{ text: prompt }])
}

/**
 * Draft a comment under someone else's post given its text (works for any
 * topic — trending or niche). Returns just the comment text.
 */
export async function composeComment(
  apiKey: string,
  postText: string,
  author?: string | null
): Promise<string | null> {
  const prompt =
    `${BRAND_VOICE}\n\n` +
    `Ось пост у Threads від @${author || 'автор'}:\n"${postText}"\n\n` +
    `Напиши КОРОТКИЙ коментар від проЯв під цим постом (1–2 речення). ` +
    `Мета — бути помітним і людяним у розмові, а не рекламувати. ` +
    `Поверни ЛИШЕ текст коментаря, без лапок.`
  return gemini(apiKey, [{ text: prompt }])
}

export interface ScreenshotDraft {
  author: string | null
  text: string
  reply: string
}

/**
 * One vision call: read a screenshot of a Threads post (any topic), extract
 * the author + post text, and draft an on-voice comment. Returns null when
 * the image can't be read as a post.
 */
export async function composeCommentFromScreenshot(
  apiKey: string,
  imageBase64: string,
  mimeType: string
): Promise<ScreenshotDraft | null> {
  const prompt =
    `${BRAND_VOICE}\n\n` +
    `На зображенні — скріншот поста в Threads (тема може бути БУДЬ-ЯКА, включно з трендами ` +
    `не про фотографію).\n` +
    `1. Витягни нік автора (без @, якщо видно) і повний текст поста.\n` +
    `2. Напиши КОРОТКИЙ коментар від проЯв під цим постом (1–2 речення) у голосі бренду.\n\n` +
    `Поверни СТРОГО JSON без markdown:\n` +
    `{"author": "нік або null", "text": "текст поста", "reply": "коментар"}`
  const out = await gemini(
    apiKey,
    [{ inline_data: { mime_type: mimeType, data: imageBase64 } }, { text: prompt }],
    0.8
  )
  if (!out) return null
  try {
    const cleaned = out.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    const parsed = JSON.parse(cleaned) as Partial<ScreenshotDraft>
    if (typeof parsed.text !== 'string' || typeof parsed.reply !== 'string') return null
    return {
      author: typeof parsed.author === 'string' && parsed.author ? parsed.author : null,
      text: parsed.text,
      reply: parsed.reply,
    }
  } catch {
    return null
  }
}
