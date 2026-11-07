import type { GiftKind, SiteContent } from '@/lib/site/content'
import type { BookingNav, PortfolioItem, SiteLabels } from '../SiteRenderer'

export type Photo = PortfolioItem & { previewUrl: string }

export interface CardFilter {
  label: string
  count: number
}
export interface CardGift {
  kind: GiftKind
  title: string
  text: string
  price: string
  photo?: Photo
}
export interface CardContactLink {
  kind: 'phone' | 'telegram' | 'instagram' | 'email'
  href: string
  label: string
}

/**
 * Everything a one-page photographer «візитка» needs, computed once and shared
 * by every theme: the six blocks (first screen, portfolio with direction
 * filters, packages + terms, about, reviews, booking + contacts) and the
 * optional «Подарунки та друк». Themes differ in LOOK, never in structure.
 */
export interface CardData {
  brand: string
  title: string
  subtitle: string
  /** «Фотограф» unless the photographer wrote their own. */
  role: string
  city: string
  /** For the first screen: the photographer's own list, else portfolio categories. */
  directions: string[]
  photos: Photo[]
  byId: (id: string) => Photo | undefined
  lead?: Photo
  portrait?: Photo
  /** Up to `gridMax` best frames (hero and portrait left out when there is enough). */
  grid: Photo[]
  /** Direction filters for the grid — only when there are 2+ directions. */
  filters: CardFilter[]
  packs: SiteContent['pricing']['items']
  terms: { key: 'prepayment' | 'delivery' | 'travel' | 'bring'; label: string; text: string }[]
  gifts: CardGift[]
  certificateTopic?: string
  reviews: { text: string; names: string; photo?: Photo }[]
  contactLinks: CardContactLink[]
  bookHref: string
  /** Topics for the form: packages, then enabled gifts. */
  topics: string[]
  navLinks: { href: string; label: string }[]
  L: Required<Pick<SiteLabels,
    'photographer' | 'termsTitle' | 'giftsTitle' | 'order' | 'filterAll' | 'testimonials' | 'popular' | 'choosePack' | 'madeOn' | 'menu' | 'bookDate' | 'allPortfolio'
  >>
}

const DEFAULT_GIFT: Record<GiftKind, (L: SiteLabels) => [string, string]> = {
  certificate: (L) => [L.giftCertificate ?? 'Подарунковий сертифікат', L.giftCertificateText ?? ''],
  book: (L) => [L.giftBook ?? 'Фотокнига', L.giftBookText ?? ''],
  prints: (L) => [L.giftPrints ?? 'Принти й постери', L.giftPrintsText ?? ''],
}

export function buildCard({
  content,
  displayName,
  portfolio,
  labels,
  leadForm,
  bookingNav,
  gridMax = 12,
}: {
  content: SiteContent
  displayName: string | null
  portfolio: PortfolioItem[]
  labels: SiteLabels
  leadForm: boolean
  bookingNav?: BookingNav
  gridMax?: number
}): CardData {
  const brand = displayName || content.hero.title || ''
  const title = content.hero.title || brand
  const photos = portfolio.filter((p): p is Photo => !!p.previewUrl)
  const byId = (id: string) => (id ? photos.find((p) => p.id === id) : undefined)

  const lead = byId(content.hero.imageId) ?? photos[0]
  const portrait = byId(content.about.imageId)
  const skip = new Set([lead?.id, portrait?.id].filter(Boolean) as string[])
  const pool = photos.length - skip.size >= 9 ? photos.filter((p) => !skip.has(p.id)) : photos
  const grid = pool.slice(0, gridMax)

  // Directions: the photographer's list first, then any other portfolio categories.
  const cats: string[] = []
  for (const p of photos) {
    const c = p.category?.trim()
    if (c && !cats.includes(c)) cats.push(c)
  }
  const directions = content.hero.directions.length > 0 ? content.hero.directions : cats.slice(0, 5)
  const filters = filtersFor(grid, directions)

  const L = {
    photographer: labels.photographer ?? 'Фотограф',
    termsTitle: labels.termsTitle ?? 'Умови',
    giftsTitle: labels.giftsTitle ?? 'Подарунки та друк',
    order: labels.order ?? 'Замовити',
    filterAll: labels.filterAll ?? 'Усі',
    testimonials: labels.testimonials ?? 'Відгуки',
    popular: labels.popular ?? 'Найчастіше обирають',
    choosePack: labels.choosePack ?? labels.book,
    madeOn: labels.madeOn ?? 'Сайт на проЯв',
    menu: labels.menu ?? 'Меню',
    bookDate: labels.bookDate ?? labels.book,
    allPortfolio: labels.allPortfolio ?? labels.portfolio,
  }

  const t = content.terms
  const terms = (
    [
      ['prepayment', labels.termsPrepayment ?? 'Передоплата', t.prepayment],
      ['delivery', labels.termsDelivery ?? 'Готові фото', t.delivery],
      ['travel', labels.termsTravel ?? 'Виїзд', t.travel],
      ['bring', labels.termsBring ?? 'Що взяти з собою', t.bring],
    ] as const
  )
    .filter(([, , text]) => text.trim())
    .map(([key, label, text]) => ({ key, label, text }))

  // Gifts: enabled cards only; a card without its own photo borrows a frame
  // the page does not show elsewhere.
  const shown = new Set([...skip, ...grid.map((p) => p.id)])
  const spare = photos.filter((p) => !shown.has(p.id))
  let spareAt = 0
  const gifts: CardGift[] = content.gifts.enabled
    ? content.gifts.items
        .filter((g) => g.enabled)
        .map((g) => {
          const [defTitle, defText] = DEFAULT_GIFT[g.kind](labels)
          const photo = byId(g.imageId) ?? spare[spareAt++] ?? photos[(spareAt++ * 3) % Math.max(photos.length, 1)]
          return { kind: g.kind, title: g.title || defTitle, text: g.text || defText, price: g.price, photo }
        })
    : []
  const certificateTopic = gifts.find((g) => g.kind === 'certificate')?.title

  const reviews = content.testimonials.items.slice(0, 3).map((r) => ({ text: r.text, names: r.names, photo: byId(r.photoId) }))

  const c = content.contact
  const instagram = c.instagram.replace(/^@/, '')
  const telegram = c.telegram.replace(/^@/, '')
  const contactLinks: CardContactLink[] = [
    ...(c.phone ? [{ kind: 'phone' as const, href: `tel:${c.phone.replace(/[^\d+]/g, '')}`, label: c.phone }] : []),
    ...(telegram ? [{ kind: 'telegram' as const, href: `https://t.me/${telegram}`, label: `Telegram · @${telegram}` }] : []),
    ...(instagram ? [{ kind: 'instagram' as const, href: `https://instagram.com/${instagram}`, label: `Instagram · @${instagram}` }] : []),
    ...(c.email ? [{ kind: 'email' as const, href: `mailto:${c.email}`, label: c.email }] : []),
  ]

  const bookHref = leadForm ? '#contact' : c.bookingUrl || bookingNav?.href || '#contact'
  const navLinks = [
    ...(grid.length > 0 ? [{ href: '#portfolio', label: labels.portfolio }] : []),
    ...(content.pricing.items.length > 0 ? [{ href: '#pricing', label: labels.pricing }] : []),
    ...(content.about.text ? [{ href: '#about', label: labels.about }] : []),
    { href: '#contact', label: labels.contacts },
    ...(bookingNav ? [bookingNav] : []),
  ]

  return {
    brand,
    title,
    subtitle: content.hero.subtitle,
    role: content.hero.role || L.photographer,
    city: content.hero.city,
    directions,
    photos,
    byId,
    lead,
    portrait,
    grid,
    filters,
    packs: content.pricing.items,
    terms,
    gifts,
    certificateTopic,
    reviews,
    contactLinks,
    bookHref,
    topics: [...content.pricing.items.map((p) => p.name), ...gifts.map((g) => g.title)],
    navLinks,
    L,
  }
}

/** srcset-aware aspect ratio of a frame. */
export const ratioOf = (p: PortfolioItem, fallback = '4 / 5') =>
  p.width && p.height ? `${p.width} / ${p.height}` : fallback

/** Filter chips for a set of frames: directions first, then other categories; none for one direction. */
export function filtersFor(items: PortfolioItem[], directions: string[]): CardFilter[] {
  const counts = new Map<string, number>()
  for (const p of items) {
    const c = p.category?.trim()
    if (c) counts.set(c, (counts.get(c) ?? 0) + 1)
  }
  const order = [...directions.filter((d) => counts.has(d)), ...[...counts.keys()].filter((c) => !directions.includes(c))]
  return order.length >= 2 ? order.map((label) => ({ label, count: counts.get(label)! })) : []
}

/**
 * Skin for the shared client components (TyshaNav, TyshaLeadForm): the chrome
 * base classes followed by the theme's classes of the same name. A plain
 * object, so it can cross into client components.
 */
export function mergeSkin(base: Record<string, string>, theme: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = { ...theme }
  for (const [k, v] of Object.entries(base)) out[k] = theme[k] ? `${v} ${theme[k]}` : v
  return out
}
