import type { Article } from './articles'

/**
 * Blog topics as indexable hub pages (/uk/blog/tema/{slug}). A topic groups
 * several article tags; an article belongs to every topic one of its tags maps
 * to. Slugs use the official transliteration (src/lib/seo/translit.ts).
 */
export interface Category {
  slug: string
  /** Short name (chips, breadcrumbs). */
  name: string
  /** H1 / share-card headline. */
  title: string
  /** Meta description, 140–160 chars. */
  description: string
  /** Lead paragraph on the hub page. */
  intro: string
  tags: string[]
}

export const CATEGORIES: Category[] = [
  {
    slug: 'halerei',
    name: 'Онлайн-галереї',
    title: 'Онлайн-галереї для фотографів',
    description:
      'Як обрати онлайн-галерею, передати фото клієнту й порівняти сервіси галерей. Практичні статті про клієнтські галереї для фотографів — без води.',
    intro:
      'Усе про те, як віддавати зйомку клієнту: як обрати сервіс галерей, чим вони відрізняються й на що дивитися, щоб клієнт не питав «а як завантажити?».',
    tags: ['галереї', 'порівняння', 'сервіси', 'інструменти'],
  },
  {
    slug: 'robota-z-kliientamy',
    name: 'Робота з клієнтами',
    title: 'Робота з клієнтами для фотографа',
    description:
      'Договір, відбір фото, передоплата й передача зйомки: статті для фотографа про те, як працювати з клієнтами спокійно, чесно й без непорозумінь.',
    intro:
      'Від першого повідомлення до переданої галереї: договір, передоплата, відбір кадрів і те, як зробити фінал зйомки таким самим охайним, як самі фото.',
    tags: ['робота з клієнтами', 'клієнти', 'договір'],
  },
  {
    slug: 'tsiny-i-oplaty',
    name: 'Ціни та оплати',
    title: 'Ціни та оплати у фотографа',
    description:
      'Як встановити ціну на фотосесію, просити передоплату, приймати оплату в Україні й рахувати витрати на зберігання фото. Практично, з прикладами.',
    intro:
      'Гроші — частина професії. Тут про те, як рахувати ціну зйомки, просити передоплату без ніяковості та скільки насправді коштує зберігати фото.',
    tags: ['фінанси', 'оплати', 'ціни'],
  },
  {
    slug: 'prosuvannia',
    name: 'Просування',
    title: 'Просування фотографа',
    description:
      'Портфоліо, Instagram, власний сайт і перші клієнти: статті про просування фотографа в Україні — що справді працює на практиці й з чого почати.',
    intro:
      'Як фотографу знаходити клієнтів: портфоліо, яке продає, Instagram, власний сайт і перші замовлення, коли ти тільки починаєш.',
    tags: ['просування', 'соцмережі', 'портфоліо', 'сайт'],
  },
  {
    slug: 'zberihannia-foto',
    name: 'Зберігання фото',
    title: 'Зберігання та бекап фотографій',
    description:
      'Резервне копіювання, архів і вартість зберігання фото: як фотографу не втратити жодної зйомки і не переплачувати за сховище. Практичні поради.',
    intro:
      'Зйомка існує, поки вона в кількох копіях. Тут про бекап, архів і те, як порахувати, скільки коштує зберігати фото за сезон.',
    tags: ['сховище', 'архів'],
  },
]

export function getCategory(slug: string): Category | undefined {
  return CATEGORIES.find((c) => c.slug === slug)
}

export function categoriesFor(article: Pick<Article, 'tags'>): Category[] {
  return CATEGORIES.filter((c) => c.tags.some((t) => article.tags.includes(t)))
}

export function articlesIn(category: Category, articles: Article[]): Article[] {
  return articles.filter((a) => a.tags.some((t) => category.tags.includes(t)))
}

/**
 * «Read next»: rank other articles by shared tags (then shared topics), newest
 * first on ties. Falls back to the newest articles if nothing overlaps.
 */
export function relatedArticles(article: Article, all: Article[], limit = 3): Article[] {
  const mine = new Set(article.tags.filter((t) => t !== 'поради'))
  const myCats = new Set(categoriesFor(article).map((c) => c.slug))
  return all
    .filter((a) => a.slug !== article.slug)
    .map((a) => {
      const shared = a.tags.filter((t) => mine.has(t)).length
      const sharedCats = categoriesFor(a).filter((c) => myCats.has(c.slug)).length
      return { a, score: shared * 2 + sharedCats }
    })
    .sort((x, y) => y.score - x.score || (x.a.date < y.a.date ? 1 : -1))
    .slice(0, limit)
    .map((x) => x.a)
}
