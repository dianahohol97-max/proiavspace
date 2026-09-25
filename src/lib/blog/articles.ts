/**
 * Blog content — Ukrainian SEO articles as structured blocks.
 *
 * Two sources, merged for the public blog:
 *  - CURATED: hand-written articles in this file (always published).
 *  - blog_articles table: AI-generated drafts the content engine writes; they
 *    go live only after an admin publishes them in the dashboard.
 */
import { createClient } from '@supabase/supabase-js'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { KEY_ARTICLES } from './key-articles'
import legacySlugs from './legacy-slugs.json'
import type { QualityReport } from './generator/types'

/** Old DB slugs are remapped on read so the 301 targets in next.config resolve. */
const LEGACY_SLUGS = legacySlugs as Record<string, string>
export function currentSlug(slug: string): string {
  return (!slug.startsWith('_') && LEGACY_SLUGS[slug]) || slug
}

/**
 * Article blocks. Text in p / ul / table cells / faq answers may contain
 * inline links written as [anchor](/uk/path) — rendered by ArticleBody.
 */
export type Block =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'table'; caption?: string; head: string[]; rows: string[][] }
  /**
   * Illustration. Without `src` it renders as a visible placeholder
   * describing the image that still has to be made (never shipped silently).
   */
  | { type: 'img'; src?: string; alt: string; caption?: string; width?: number; height?: number; narrow?: boolean }
  | { type: 'faq'; items: { q: string; a: string }[] }
  | { type: 'cta'; text: string; href: string }

/** Real (non-placeholder) images of an article — for the image sitemap. */
export function articleImages(article: Article): { src: string; alt: string }[] {
  return article.body.flatMap((b) => (b.type === 'img' && b.src ? [{ src: b.src, alt: b.alt }] : []))
}

/** FAQ items of an article (for FAQPage structured data). */
export function articleFaq(article: Article): { q: string; a: string }[] {
  return article.body.flatMap((b) => (b.type === 'faq' ? b.items : []))
}

export interface Article {
  slug: string
  /** H1 (may be long). */
  title: string
  /** <title> — ≤ 60 characters including « — проЯв». Falls back to `title`. */
  seoTitle?: string
  description: string
  /** ISO date of first publication. */
  date: string
  /** ISO date of the last meaningful update (dateModified). Defaults to `date`. */
  updated?: string
  readingMinutes: number
  tags: string[]
  body: Block[]
  /** Author slug (src/lib/blog/authors.ts); defaults to the blog's author. */
  author?: string
  /** Optional co-author (e.g. the photographer whose shots illustrate it). */
  coauthor?: Coauthor
  /** Internal links are part of the text (generator v2) — no auto-inserted paragraph. */
  linksManaged?: boolean
}

export interface Coauthor {
  name: string
  url?: string
  /** Shown before the name, e.g. «Фото». */
  role?: string
}

/**
 * Hand-written articles. Content is Ukrainian (the launch market); the blog
 * canonicalizes to /uk/blog regardless of the route locale.
 */
const CURATED: Article[] = [
  ...KEY_ARTICLES,
  {
    slug: 'yak-pryimaty-oplatu-za-foto',
    title: 'Як приймати оплату за фотопослуги в Україні',
    description:
      'Як приймати оплату за фотопослуги в Україні: переказ, банка, еквайринг чи ФОП, як просити передоплату й видавати чеки, щоб клієнту було зручно платити.',
    date: '2026-07-07',
    updated: '2026-09-25',
    readingMinutes: 5,
    tags: ['оплати', 'фінанси', 'робота з клієнтами'],
    body: [
      { type: 'p', text: 'Питання «як приймати оплату за фотопослуги в Україні» здається технічним, але насправді воно про довіру й про твій спокій. Незручна оплата — це загублені клієнти, ніякове «скиньте на картку» й ризик, що людина передумає ще до зйомки. Розберімо, які способи є, як грамотно брати передоплату й зробити так, щоб платити тобі було так само легко, як подобаються твої кадри.' },
      { type: 'h2', text: 'Які способи оплати є у фотографа' },
      { type: 'p', text: 'На практиці більшість українських фотографів користуються кількома варіантами, у кожного свої плюси:' },
      { type: 'ul', items: ['Переказ на картку — просто, але виглядає неформально й губиться в чатах.', 'Оплата через банку чи посилання на оплату — зручніше й акуратніше для клієнта.', 'ФОП із рахунком — потрібен, якщо працюєш офіційно й видаєш документи.', 'Оплата за посиланням на бронювання — клієнт обирає вільний час і одразу вносить оплату через Monobank, WayForPay, на банку чи за реквізитами; гроші йдуть напряму фотографу.'] },
      { type: 'p', text: 'Що менше кроків між рішенням заплатити й самою оплатою, то вища ймовірність, що клієнт дійде до кінця.' },
      { type: 'h2', text: 'Передоплата: чому це нормально' },
      { type: 'p', text: 'Багато фотографів соромляться просити передоплату, а дарма. Це стандартна практика, яка захищає твій час від зривів і показує, що ти працюєш серйозно. Кілька орієнтирів, як робити це спокійно:' },
      { type: 'ul', items: ['Бери частину суми як бронь дати — так слот справді закріплений за клієнтом.', 'Пропиши умови заздалегідь: розмір передоплати, що буде при скасуванні.', 'Формулюй як турботу: передоплата фіксує твій час саме для цього клієнта.', 'Зроби оплату миттєвою — посиланням чи кнопкою, а не реквізитами в стовпчик.'] },
      { type: 'p', text: 'Коли умови прозорі й оплата легка, передоплата не відлякує, а навпаки додає відчуття надійності.' },
      { type: 'h2', text: 'Оплата напряму тобі, без посередників' },
      { type: 'p', text: 'Важлива деталь, яку варто перевіряти в будь-якому сервісі: куди йдуть гроші. Деякі закордонні платформи проводять оплату через себе, беруть комісію й затримують виплати. Для українського фотографа зручніше, коли клієнт платить безпосередньо тобі. У проЯв оплати йдуть напряму — через Monobank і картки, без платформи-посередника між тобою й твоїми грошима. Ти отримуєш кошти одразу на свій рахунок, а клієнт бачить звичний йому спосіб оплати.' },
      { type: 'h2', text: 'Оплата як частина бронювання' },
      { type: 'p', text: 'Найзручніший сценарій для обох сторін — коли оплата вбудована в процес. Клієнт відкриває сторінку бронювання, обирає вільний слот, вносить передоплату — і дата закріплена, без переписки й реквізитів у чаті. Так ти прибираєш незручний етап «скиньте реквізити» й перетворюєш оплату на природну частину досвіду, а не на окрему операцію, під час якої клієнт може передумати.' },
      { type: 'h2', text: 'Чеки, документи й довіра' },
      { type: 'p', text: 'Якщо працюєш як ФОП, подбай, щоб клієнт за потреби отримав підтвердження оплати — це підвищує довіру, особливо на дорожчих зйомках і в роботі з бізнесом. Навіть просте охайне повідомлення з підсумком «за що й скільки» знімає більшість питань. Головний принцип простий: чим прозоріші й зрозуміліші для клієнта гроші, тим легше він каже «так» і повертається знову.' },
      { type: 'p', text: 'Якщо оплати досі живуть у переписках і реквізитах, спробуй перенести їх у єдиний зручний процес. У проЯв клієнт може забронювати зйомку й одразу оплатити її напряму тобі — через Monobank-еквайринг, WayForPay, банку чи реквізити, а фото після зйомки отримати в [онлайн-галереї](/uk/halerei).' },
      { type: 'cta', text: 'Спробувати проЯв безкоштовно', href: '/uk/login' },
    ],
  },
]

/* ---------- generated articles (blog_articles table) ---------- */

/** DB row → Article. Also carries admin-only fields (id, status). */
export interface AdminArticle extends Article {
  id: string
  status: 'draft' | 'published'
  source: string
  /** generator/quality.ts report of the current body. */
  qualityReport?: QualityReport
  /** Pending rewrite ("update existing article" mode), not live yet. */
  revision?: Revision
}

export interface Revision {
  title: string
  seoTitle?: string
  description: string
  tags: string[]
  body: Block[]
  readingMinutes: number
  report?: QualityReport
  generatedAt: string
  provider?: string
}

interface Row {
  id: string
  slug: string
  title: string
  description: string
  published_date: string
  reading_minutes: number
  tags: unknown
  body: unknown
  status: string
  source: string
  created_at?: string | null
  updated_at?: string | null
  // v2 columns (migration 0035) — optional until it is applied.
  seo_title?: string | null
  author?: string | null
  coauthor?: Coauthor | null
  modified_date?: string | null
  quality_report?: QualityReport | null
  revision?: Revision | null
}

/**
 * dateModified for DB articles: only a real edit counts — updated_at later
 * than the insert (the seed/publish flow writes both at once).
 */
function editedDate(row: Row): string | undefined {
  if (!row.created_at || !row.updated_at) return undefined
  const edited = new Date(row.updated_at).getTime() - new Date(row.created_at).getTime() > 60_000
  const day = row.updated_at.slice(0, 10)
  return edited && day > row.published_date ? day : undefined
}

function rowToAdmin(row: Row): AdminArticle {
  return {
    id: row.id,
    slug: currentSlug(row.slug),
    title: row.title,
    description: row.description,
    date: row.published_date,
    readingMinutes: row.reading_minutes,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    body: Array.isArray(row.body) ? (row.body as Block[]) : [],
    status: row.status === 'published' ? 'published' : 'draft',
    source: row.source,
    updated: row.modified_date ?? editedDate(row),
    seoTitle: row.seo_title ?? undefined,
    author: row.author ?? undefined,
    coauthor: row.coauthor ?? undefined,
    // Rows from the v1 engine are source 'ai'; v2 writes 'ai:<provider>' or 'editor'.
    linksManaged: row.source !== 'ai',
    qualityReport: row.quality_report ?? undefined,
    revision: row.revision ?? undefined,
  }
}

/** Anon client for public reads (RLS returns only published rows). */
function anonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

/** Public columns only — revision / sources / report stay admin-side. Needs migration 0035. */
const PUBLIC_COLS =
  'id, slug, title, description, published_date, reading_minutes, tags, body, status, source, created_at, updated_at, seo_title, author, coauthor, modified_date'

async function fetchPublished(): Promise<Article[]> {
  const supabase = anonClient()
  if (!supabase) return []
  const { data } = await supabase
    .from('blog_articles')
    .select(PUBLIC_COLS)
    .eq('status', 'published')
  return ((data as Row[] | null) ?? []).map(rowToAdmin)
}

/** All PUBLISHED articles (curated + published DB), newest first. */
export async function getArticles(): Promise<Article[]> {
  const bySlug = new Map<string, Article>()
  for (const article of [...(await fetchPublished()), ...CURATED]) bySlug.set(article.slug, article)
  return [...bySlug.values()].sort((a, b) => (a.date < b.date ? 1 : -1))
}

export async function getArticle(slug: string): Promise<Article | null> {
  const curated = CURATED.find((a) => a.slug === slug)
  if (curated) return curated
  return (await fetchPublished()).find((a) => a.slug === slug) ?? null
}

/* ---------- admin (service role — bypasses RLS, sees drafts) ---------- */

const ADMIN_COLS = `${PUBLIC_COLS}, quality_report, revision`

/** Every DB article (draft + published), newest first. Admin only. */
export async function getAdminArticles(): Promise<AdminArticle[]> {
  const admin = createSupabaseAdminClient()
  if (!admin) return []
  const { data } = await admin
    .from('blog_articles')
    .select(ADMIN_COLS)
    .order('created_at', { ascending: false })
  return ((data as Row[] | null) ?? []).map(rowToAdmin)
}

export async function getAdminArticle(id: string): Promise<AdminArticle | null> {
  const admin = createSupabaseAdminClient()
  if (!admin) return null
  const { data } = await admin.from('blog_articles').select(ADMIN_COLS).eq('id', id).maybeSingle()
  return data ? rowToAdmin(data as Row) : null
}

export async function getTopicStats(): Promise<{ todo: number; done: number }> {
  const admin = createSupabaseAdminClient()
  if (!admin) return { todo: 0, done: 0 }
  const [{ count: todo }, { count: done }] = await Promise.all([
    admin.from('blog_topics').select('*', { count: 'exact', head: true }).eq('status', 'todo'),
    admin.from('blog_topics').select('*', { count: 'exact', head: true }).eq('status', 'done'),
  ])
  return { todo: todo ?? 0, done: done ?? 0 }
}

/** Curated (built-in) articles — shown read-only in the admin list. */
export function getCuratedArticles(): Article[] {
  return [...CURATED].sort((a, b) => (a.date < b.date ? 1 : -1))
}
