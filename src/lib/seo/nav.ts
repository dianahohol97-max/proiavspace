/**
 * Public navigation. Ukrainian points at the dedicated product pages (each a
 * real, indexable URL instead of a #anchor); English has no product pages
 * yet, so it keeps the landing anchors.
 */
export interface NavLink {
  label: string
  href: string
}

export function primaryNav(locale: string): NavLink[] {
  if (locale === 'uk') {
    return [
      { label: 'Галереї', href: '/uk/halerei' },
      { label: 'Тарифи', href: '/uk/tsiny' },
      { label: 'Блог', href: '/uk/blog' },
    ]
  }
  return [
    { label: 'Galleries', href: `/${locale}#galleries` },
    { label: 'Pricing', href: `/${locale}#pricing` },
    // The blog is Ukrainian-only; /en/blog redirects there anyway.
    { label: 'Blog', href: '/uk/blog' },
  ]
}

/** Footer columns (Ukrainian only — the product and comparison pages are uk). */
export const FOOTER_UK: { title: string; links: NavLink[] }[] = [
  {
    title: 'Продукт',
    links: [
      { label: 'Онлайн-галерея для фотографа', href: '/uk/halerei' },
      { label: 'Галерея з паролем', href: '/uk/halereia-z-parolem' },
      { label: 'Для весільних фотографів', href: '/uk/dlia-vesilnykh-fotohrafiv' },
      { label: 'Тарифи', href: '/uk/tsiny' },
      { label: 'Демо галереї', href: '/uk/gallery-demo' },
    ],
  },
  {
    title: 'Перехід',
    // The comparison hub and per-service pages stay drafts (noindex, unlinked)
    // until the competitor facts are confirmed.
    links: [
      { label: 'Перехід з Pixieset', href: '/uk/mihratsiia' },
    ],
  },
  {
    title: 'Ресурси',
    links: [
      { label: 'Блог', href: '/uk/blog' },
      { label: 'Як передати фото клієнту', href: '/uk/blog/yak-peredaty-foto-kliientu' },
      { label: 'Публічна оферта', href: '/uk/oferta' },
      { label: 'Політика конфіденційності', href: '/uk/privacy' },
      { label: 'Підтримка', href: '/uk/contact' },
    ],
  },
]
