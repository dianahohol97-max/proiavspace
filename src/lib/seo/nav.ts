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
    { label: 'Blog', href: `/${locale}/blog` },
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
    title: 'Порівняння',
    links: [
      { label: 'проЯв vs Pixieset', href: '/uk/porivniannia/pixieset' },
      { label: 'проЯв vs Pic-Time', href: '/uk/porivniannia/pic-time' },
      { label: 'проЯв vs Pixover', href: '/uk/porivniannia/pixover' },
      { label: 'проЯв vs Gallery4you', href: '/uk/porivniannia/gallery4you' },
    ],
  },
  {
    title: 'Ресурси',
    links: [
      { label: 'Блог', href: '/uk/blog' },
      { label: 'Як передати фото клієнту', href: '/uk/blog/yak-peredaty-foto-kliientu' },
      { label: 'Публічна оферта', href: '/uk/oferta' },
      { label: 'Політика конфіденційності', href: '/uk/privacy' },
    ],
  },
]
