import type { Block } from '@/lib/blog/articles'
import type { LinkTargets } from './link-targets'
import { hasRawMarkers } from './prices'
import type { Draft, Issue, PriceRef, QualityReport } from './types'

/**
 * Automatic editorial check run after every generation (and by the CLI on a
 * hand-written article). Errors block "ready to publish"; warnings are for the
 * human reviewer.
 */

export const WORDS = { min: 1500, max: 2500 }

/** Water phrases — extend freely (lowercase, matched as substrings). */
export const FORBIDDEN_PHRASES = [
  'у сучасному світі',
  'в сучасному світі',
  'важливо пам’ятати',
  "важливо пам'ятати",
  'важливо памʼятати',
  'не секрет, що',
  'ні для кого не секрет',
  'як відомо',
  'в наш час',
  'у наш час',
  'на сьогоднішній день',
  'в епоху',
  'відіграє важливу роль',
  'варто зазначити',
  'слід зазначити',
  'давайте розберемося',
  'підсумовуючи вищесказане',
]

/** Things proiav does not do / must not be mentioned. */
export const FORBIDDEN_PRODUCT = [
  'конструктор сайт',
  'сайт за вечір',
  'персональний сайт фотографа',
  'магазин друку проЯв',
]

const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g
/** 1 234 ₴ · 300 грн · $15 · 15 $ · 12,99 € · 15 USD · €12 */
const PRICE =
  /(?:[$€£]\s?\d)|(?:\d[\d\s .,]*\s?(?:₴|грн|\$|€|£|USD|EUR|UAH|долар|євро))/i

function linksOf(text: string): string[] {
  return [...text.matchAll(LINK)].map((m) => m[2])
}

function stripLinks(text: string): string {
  return text.replace(LINK, '$1')
}

function countWords(text: string): number {
  return stripLinks(text)
    .split(/\s+/)
    .filter((w) => /[\p{L}\d]/u.test(w)).length
}

/** Every piece of reader-visible text, with its "unit" for per-unit checks. */
function units(body: Block[]): { kind: string; text: string; context?: string }[] {
  const out: { kind: string; text: string; context?: string }[] = []
  for (const b of body) {
    switch (b.type) {
      case 'p':
      case 'h2':
      case 'h3':
        out.push({ kind: b.type, text: b.text })
        break
      case 'ul':
      case 'ol':
        for (const i of b.items) out.push({ kind: 'li', text: i })
        break
      case 'table':
        for (const r of b.rows)
          out.push({ kind: 'row', text: r.join(' | '), context: `${b.caption ?? ''} ${b.head.join(' ')}` })
        break
      case 'faq':
        for (const i of b.items) out.push({ kind: 'faq', text: `${i.q} ${i.a}` })
        break
      case 'cta':
        out.push({ kind: 'cta', text: b.text })
        break
      default:
        break
    }
  }
  return out
}

export function wordCount(body: Block[]): number {
  return units(body)
    .filter((u) => u.kind !== 'cta')
    .reduce((n, u) => n + countWords(u.text), 0)
}

/**
 * All significant words of the query appear in the text, matched by stem
 * (word minus its last 2 letters) so «програма» matches «програми».
 */
export function containsQuery(text: string, query: string): boolean {
  const hay = text.toLowerCase()
  return query
    .toLowerCase()
    .split(/[^\p{L}\d]+/u)
    .filter((w) => w.length > 2)
    .every((w) => hay.includes(w.slice(0, Math.max(3, w.length - 2))))
}

const clip = (s: string, n = 90) => (s.length > n ? `${s.slice(0, n)}…` : s)

export interface CheckContext {
  query: string
  targets: LinkTargets
  /** Price markers found at expansion (for the source-page check). */
  prices?: PriceRef[]
}

export function checkArticle(draft: Draft, ctx: CheckContext): QualityReport {
  const issues: Issue[] = []
  const err = (check: string, message: string) => issues.push({ level: 'error', check, message })
  const warn = (check: string, message: string) => issues.push({ level: 'warning', check, message })
  const body = draft.body

  /* --- size & structure --- */
  const words = wordCount(body)
  if (words < WORDS.min || words > WORDS.max) err('обсяг', `${words} слів (потрібно ${WORDS.min}–${WORDS.max})`)

  const firstH2 = body.findIndex((b) => b.type === 'h2')
  const intro = body.slice(0, firstH2 < 0 ? body.length : firstH2).filter((b) => b.type === 'p').length
  if (intro < 2 || intro > 3) err('вступ', `${intro} абзаців до першого H2 (потрібно 2–3)`)
  if (body[0]?.type !== 'p') err('вступ', 'стаття має починатися з абзацу')
  if (!containsQuery(body[0]?.type === 'p' ? body[0].text : '', ctx.query))
    warn('вступ', `перший абзац не містить запит «${ctx.query}»`)

  const h2s = body.filter((b): b is Extract<Block, { type: 'h2' }> => b.type === 'h2')
  if (h2s.length < 4) err('структура', `лише ${h2s.length} H2`)
  const tables = body.filter((b) => b.type === 'table').length
  if (tables < 1) err('таблиця', 'немає таблиці порівняння')
  if (!h2s.some((h) => /кому\s+не\s+підійде/i.test(h.text))) err('кому не підійде', 'немає розділу «Кому не підійде»')
  const faq = body.flatMap((b) => (b.type === 'faq' ? b.items : []))
  if (faq.length < 3 || faq.length > 5) err('FAQ', `${faq.length} питань у FAQ (потрібно 3–5)`)
  const images = body.filter((b) => b.type === 'img')
  for (const img of images) {
    if (img.type === 'img' && (!img.alt || img.alt.length < 15)) err('зображення', 'плейсхолдер без змістовного alt')
    if (img.type === 'img' && !img.src && !img.caption) warn('зображення', `плейсхолдер «${clip(img.alt, 40)}» без опису`)
  }
  if (body.filter((b) => b.type === 'cta').length > 1) err('cta', 'більше одного CTA')
  if (hasRawMarkers(body)) err('ціни', 'залишились нерозгорнуті маркери {{…}}')

  /* --- SEO fields --- */
  if (draft.seoTitle.length > 60) err('title', `seoTitle ${draft.seoTitle.length} символів (≤ 60)`)
  if (!containsQuery(draft.seoTitle, ctx.query)) err('title', `seoTitle без запиту «${ctx.query}»`)
  const dl = draft.description.length
  if (dl < 140 || dl > 160) err('description', `description ${dl} символів (140–160)`)
  if (!containsQuery(draft.description, ctx.query)) err('description', `description без запиту «${ctx.query}»`)

  /* --- forbidden phrases --- */
  const all = units(body).map((u) => u.text.toLowerCase())
  const fullText = `${draft.title} ${draft.description} ${all.join(' ')}`.toLowerCase()
  for (const phrase of FORBIDDEN_PHRASES)
    if (fullText.includes(phrase.toLowerCase())) err('заборонені фрази', `«${phrase}»`)
  for (const phrase of FORBIDDEN_PRODUCT)
    if (fullText.includes(phrase.toLowerCase())) err('фічі проЯв', `згадка «${phrase}»`)

  /* --- prices: source + «станом на» in the same unit --- */
  let priceUnits = 0
  for (const u of units(body)) {
    if (u.kind === 'h2' || u.kind === 'h3' || u.kind === 'cta') continue
    if (!PRICE.test(stripLinks(u.text))) continue
    priceUnits++
    const external = linksOf(u.text).some((h) => /^https?:\/\//.test(h))
    if (!external) err('джерело ціни', `ціна без посилання на джерело: «${clip(stripLinks(u.text))}»`)
    const asOf = /станом на/i.test(u.text) || /станом на/i.test(u.context ?? '')
    if (!asOf) err('станом на', `ціна без «станом на»: «${clip(stripLinks(u.text))}»`)
  }

  /* --- links --- */
  const hrefs = units(body).flatMap((u) => linksOf(u.text))
  const internal = [...new Set(hrefs.filter((h) => h.startsWith('/')))].map((h) => h.split('#')[0])
  const productPaths = new Set(ctx.targets.product.map((t) => t.path))
  const articlePaths = new Set(ctx.targets.articles.map((t) => t.path))
  const other = new Set(ctx.targets.other)
  const productLinks = internal.filter((h) => productPaths.has(h))
  const articleLinks = internal.filter((h) => articlePaths.has(h))
  for (const h of internal)
    if (!productPaths.has(h) && !articlePaths.has(h) && !other.has(h))
      err('посилання', `внутрішнє посилання на неіснуючу сторінку: ${h}`)
  if (productLinks.length !== 1)
    err('посилання', `${productLinks.length} продуктових посилань (потрібно рівно 1): ${productLinks.join(', ') || '—'}`)
  if (articleLinks.length < 2) err('посилання', `${articleLinks.length} посилань на статті (потрібно 2)`)
  // "Contextual, not a list at the end": no internal link inside the last list.
  const lastList = [...body].reverse().find((b) => b.type === 'ul' || b.type === 'ol')
  const tail = body.slice(-4)
  if (lastList && tail.includes(lastList) && JSON.stringify(lastList).includes('](/uk/'))
    warn('посилання', 'внутрішні посилання списком наприкінці — перенеси в текст')
  const external = hrefs.filter((h) => /^https?:\/\//.test(h))
  for (const h of new Set(external))
    if (/vertexaisearch\.cloud\.google\.com|grounding-api-redirect/.test(h))
      err('джерела', `посилання-редирект замість реального URL: ${clip(h, 60)}`)

  /* --- "every paragraph carries a fact" (heuristic → warning) --- */
  for (const b of body) {
    if (b.type !== 'p') continue
    const t = stripLinks(b.text)
    const hasFact = /\d/.test(t) || linksOf(b.text).length > 0 || /[A-Z][a-zA-Z]+/.test(t) || /«[^»]+»/.test(t)
    if (!hasFact) warn('вода?', `абзац без цифри, назви чи посилання: «${clip(t)}»`)
  }

  return {
    ok: !issues.some((i) => i.level === 'error'),
    checkedAt: new Date().toISOString(),
    words,
    stats: {
      intro,
      h2: h2s.length,
      tables,
      faq: faq.length,
      images: images.length,
      prices: priceUnits,
      productLinks,
      articleLinks,
      externalLinks: new Set(external).size,
    },
    issues,
  }
}

/**
 * Network part of the check: every external source answers, and every
 * price number is present on its source page. Pricing pages are often
 * rendered by JS, so a missing number is a warning, not an error.
 */
export async function checkSources(draft: Draft, prices: PriceRef[], timeoutMs = 12_000): Promise<Issue[]> {
  const issues: Issue[] = []
  const urls = new Set<string>()
  for (const u of JSON.stringify(draft.body).matchAll(/\]\((https?:\/\/[^)\s"]+)\)/g)) urls.add(u[1])
  const pages = new Map<string, string | null>()
  await Promise.all(
    [...urls].map(async (url) => {
      try {
        const res = await fetch(url, {
          redirect: 'follow',
          signal: AbortSignal.timeout(timeoutMs),
          headers: { 'User-Agent': 'Mozilla/5.0 (proiav.space blog fact-check)' },
        })
        if (!res.ok) {
          issues.push({ level: 'warning', check: 'джерела', message: `HTTP ${res.status}: ${url}` })
          pages.set(url, null)
          return
        }
        pages.set(url, (await res.text()).replace(/<[^>]+>/g, ' '))
      } catch (error) {
        issues.push({ level: 'warning', check: 'джерела', message: `не відкрилось (${(error as Error).name}): ${url}` })
        pages.set(url, null)
      }
    })
  )
  for (const p of prices) {
    if (p.amount === null) continue
    const page = pages.get(p.url)
    if (!page) continue
    const [int, frac] = String(p.amount).split('.')
    const variants = [String(p.amount), frac ? `${int},${frac}` : int, int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')]
    if (!variants.some((v) => page.includes(v)))
      issues.push({
        level: 'warning',
        check: 'ціна на сторінці',
        message: `${p.amount} ${p.currency} не знайдено в HTML ${p.url} (сторінка може рендеритись JS — перевір вручну)`,
      })
  }
  return issues
}

/** Plain-text report for the CLI / logs. */
export function formatReport(title: string, r: QualityReport): string {
  const s = r.stats
  const lines = [
    `${r.ok ? '✓' : '✖'} ${title}`,
    `  слів: ${r.words} · вступ: ${s.intro} абз. · H2: ${s.h2} · таблиць: ${s.tables} · FAQ: ${s.faq} · зображень: ${s.images}`,
    `  блоків з цінами: ${s.prices} · зовнішніх джерел: ${s.externalLinks}`,
    `  продукт: ${s.productLinks.join(', ') || '—'} · статті: ${s.articleLinks.join(', ') || '—'}`,
  ]
  for (const i of r.issues) lines.push(`  ${i.level === 'error' ? 'ПОМИЛКА' : 'увага  '} [${i.check}] ${i.message}`)
  if (!r.issues.length) lines.push('  зауважень немає')
  return lines.join('\n')
}
