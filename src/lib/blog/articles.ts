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
}

/**
 * Hand-written articles. Content is Ukrainian (the launch market); the blog
 * canonicalizes to /uk/blog regardless of the route locale.
 */
const CURATED: Article[] = [
  ...KEY_ARTICLES,
  {
    slug: 'sait-fotohrafa-za-vechir',
    title: 'Власний сайт фотографа за вечір: навіщо і як зробити',
    description:
      'Навіщо фотографу власний сайт, якщо є Instagram, і як зібрати його за вечір: що має бути на сторінках, домен, SEO і бронювання без розробників.',
    date: '2026-07-10',
    readingMinutes: 5,
    tags: ['сайт', 'просування', 'поради'],
    body: [
      { type: 'p', text: 'Власний сайт фотографа за вечір звучить як перебільшення, але сьогодні це цілком реально — без розробників, верстки й місяців чекання. Питання радше не «як», а «навіщо», адже в багатьох уся присутність зводиться до Instagram. Розберімо, чому сторінка в соцмережі не замінює сайт і як зібрати свій за один спокійний вечір, щоб він працював на тебе, а не просто «був».' },
      { type: 'h2', text: 'Навіщо сайт, якщо є Instagram' },
      { type: 'p', text: 'Instagram — чудова вітрина, але вона не твоя. Алгоритм вирішує, хто побачить твої роботи, стрічка ховає старі пости, а весь твій контакт із клієнтом залежить від однієї платформи. Сайт закриває те, чого соцмережа дати не може:' },
      { type: 'ul', items: ['Тебе знаходять у пошуку за запитами на кшталт «фотограф у моєму місті», а не лише в стрічці.', 'Портфоліо структуроване за напрямами, а не тоне в хронології постів.', 'Ціни, умови й відповіді на часті питання — в одному місці, без переписок.', 'Клієнт бронює зйомку сам, у зручний час, без гри в «а коли у вас вільно».', 'Це твій актив, який не зникне через блокування акаунта.'] },
      { type: 'p', text: 'Сайт не конкурує з Instagram — він робить його ефективнішим, бо в біо нарешті є куди вести людину.' },
      { type: 'h2', text: 'Що має бути на сайті фотографа' },
      { type: 'p', text: "Не ускладнюй. Хороший сайт фотографа — це кілька сильних екранів, а не десять розділів. Мінімум, який працює:" },
      { type: 'ul', items: ["Головний екран із твоїм найсильнішим кадром і зрозумілим «хто ти і що знімаєш».", "Портфоліо, розбите за напрямами: портрет, сім'я, весілля тощо.", 'Коротко про тебе — щоб клієнт відчув людину, а не безликий бренд.', 'Послуги й орієнтовні ціни або хоча б формат «від».', 'Форма бронювання чи контакт, щоб дію можна було зробити одразу.'] },
      { type: 'h2', text: 'Чому це справді робиться за вечір' },
      { type: 'p', text: 'Раніше сайт означав дизайнера, верстальника й бюджет. Тепер у сервісах на кшталт проЯв персональний сайт збирається з готових блоків: обираєш шаблон, підставляєш свої фото, пишеш пару абзаців про себе — і сторінка готова. Ти не думаєш про код і хостинг, а зосереджуєшся на тому, що показати й якими словами. Реально вкластися в один вечір, а не в проєкт на місяць.' },
      { type: 'h2', text: 'Домен і SEO без болю' },
      { type: 'p', text: "Два моменти, які відрізняють «сторінку для галочки» від сайту, що приводить клієнтів. Перше — власний домен: адреса виду твоє-ім'я викликає більше довіри й запам'ятовується краще за посилання на соцмережу. Друге — базове SEO: коли сайт правильно описаний для пошукових систем, тебе починають знаходити люди, які шукають фотографа саме зараз. У проЯв можна підключити власний домен, а SEO-основа вже вбудована, тож не треба бути технарем, щоб з'явитися в пошуку." },
      { type: 'h2', text: 'Бронювання, яке економить твій час' },
      { type: 'p', text: 'Найприємніший бонус сайту — бронювання зі слотами. Ти один раз налаштовуєш вільний час, а клієнт сам обирає дату й лишає заявку. Замість десятка повідомлень «а коли зручно» ти отримуєш готове бронювання й прямуєш до зйомки. Це не лише економія часу, а й відчуття, що ти працюєш як бренд, а не як приватне листування.' },
      { type: 'p', text: 'Якщо давно відкладав сайт, це саме той випадок, коли варто просто почати. У проЯв можна безкоштовно зібрати основу, підключити домен пізніше й побачити, як виглядає твій особистий сайт із портфоліо та бронюванням на proiav.space.' },
      { type: 'cta', text: 'Спробувати проЯв безкоштовно', href: '/uk/login' },
    ],
  },
  {
    slug: 'yak-pryimaty-oplatu-za-foto',
    title: 'Як приймати оплату за фотопослуги в Україні',
    description:
      'Як приймати оплату за фотопослуги в Україні: переказ, банка, еквайринг чи ФОП, як просити передоплату й видавати чеки, щоб клієнту було зручно платити.',
    date: '2026-07-07',
    readingMinutes: 5,
    tags: ['оплати', 'фінанси', 'робота з клієнтами'],
    body: [
      { type: 'p', text: 'Питання «як приймати оплату за фотопослуги в Україні» здається технічним, але насправді воно про довіру й про твій спокій. Незручна оплата — це загублені клієнти, ніякове «скиньте на картку» й ризик, що людина передумає ще до зйомки. Розберімо, які способи є, як грамотно брати передоплату й зробити так, щоб платити тобі було так само легко, як подобаються твої кадри.' },
      { type: 'h2', text: 'Які способи оплати є у фотографа' },
      { type: 'p', text: 'На практиці більшість українських фотографів користуються кількома варіантами, у кожного свої плюси:' },
      { type: 'ul', items: ['Переказ на картку — просто, але виглядає неформально й губиться в чатах.', 'Оплата через банку чи посилання на оплату — зручніше й акуратніше для клієнта.', 'ФОП із рахунком — потрібен, якщо працюєш офіційно й видаєш документи.', 'Оплата прямо в галереї чи на сайті — коли клієнт платить за зйомку або доступ до фото в один клік.'] },
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
  }
}

/** Anon client for public reads (RLS returns only published rows). */
function anonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function fetchPublished(): Promise<Article[]> {
  const supabase = anonClient()
  if (!supabase) return []
  const { data } = await supabase
    .from('blog_articles')
    .select('id, slug, title, description, published_date, reading_minutes, tags, body, status, source')
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

const ADMIN_COLS =
  'id, slug, title, description, published_date, reading_minutes, tags, body, status, source'

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
