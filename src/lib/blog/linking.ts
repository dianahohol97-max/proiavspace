import type { Article, Block } from './articles'
import { categoriesFor } from './categories'

/**
 * Automatic contextual linking: every article must point at least twice at
 * the product pages. Hand-written articles already do; for the rest (incl.
 * AI-generated DB articles) a short, topic-matched paragraph is woven into
 * the body at render time — the stored content is never modified.
 */
const PRODUCT_PATHS = [
  '/uk/halerei',
  '/uk/tsiny',
  '/uk/halereia-z-parolem',
  '/uk/dlia-vesilnykh-fotohrafiv',
  '/uk/porivniannia',
  '/uk/gallery-demo',
]

const BY_TOPIC: Record<string, string> = {
  halerei:
    'До речі: готову зйомку зручно віддавати в [онлайн-галереї](/uk/halerei) — клієнт сам позначить улюблені кадри сердечками, а для приватних зйомок є [пароль і термін дії](/uk/halereia-z-parolem).',
  'robota-z-kliientamy':
    'Фінал зйомки теж частина сервісу: в [онлайн-галереї](/uk/halerei) клієнт обирає кадри без реєстрації й забирає оригінали сам, а чутливі зйомки можна закрити [паролем](/uk/halereia-z-parolem).',
  'tsiny-i-oplaty':
    'Порахуй і витрати на передачу зйомок: [тарифи онлайн-галереї](/uk/tsiny) в гривні починаються з безкоштовних 3 ГБ, а що входить у галерею — на сторінці [онлайн-галерея для фотографа](/uk/halerei).',
  'zberihannia-foto':
    'Для клієнтів онлайн має лежати лише фінальна віддача — у [онлайн-галереї](/uk/halerei) рахуються тільки оригінали, а [тарифи](/uk/tsiny) залежать лише від місця.',
  prosuvannia:
    'Галерея, яку клієнт пересилає друзям, теж працює на твоє імʼя: в [онлайн-галереї](/uk/halerei) з Базового тарифу стоїть лише твій логотип — [порівняй тарифи](/uk/tsiny).',
}

const FALLBACK = BY_TOPIC.halerei

function productLinkCount(blocks: Block[]): number {
  const text = JSON.stringify(blocks)
  return PRODUCT_PATHS.reduce((n, path) => n + (text.includes(`](${path})`) ? 1 : 0), 0)
}

export function withProductLinks(article: Article): Block[] {
  if (productLinkCount(article.body) >= 2) return article.body
  const topic = categoriesFor(article)[0]?.slug
  const paragraph: Block = { type: 'p', text: (topic && BY_TOPIC[topic]) || FALLBACK }
  // After the paragraph that follows the second H2 (roughly the first third).
  const h2s = article.body.map((b, i) => (b.type === 'h2' ? i : -1)).filter((i) => i >= 0)
  const anchor = h2s[1] ?? h2s[0]
  let at = article.body.length
  if (anchor !== undefined) {
    const next = article.body.findIndex((b, i) => i > anchor && b.type === 'p')
    if (next >= 0) at = next + 1
  }
  // Keep the closing CTA last.
  const ctaAt = article.body.findIndex((b) => b.type === 'cta')
  if (ctaAt >= 0 && at > ctaAt) at = ctaAt
  return [...article.body.slice(0, at), paragraph, ...article.body.slice(at)]
}
