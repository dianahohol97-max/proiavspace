/**
 * Blog authors. Every article is attributed to an author page
 * (/uk/autor/{slug}); Article JSON-LD uses Person with that url.
 */
export interface Author {
  slug: string
  name: string
  /** 1–2 sentences, no invented credentials. */
  bio: string
  /** Portrait in /public (e.g. /authors/eva-khudiuk.webp); initials are shown until set. */
  photo?: string
}

export const AUTHORS: Author[] = [
  {
    slug: 'eva-khudiuk',
    name: 'Ева Худюк',
    bio: 'Пише для проЯв про робочі процеси фотографів: як передавати зйомки клієнтам, рахувати витрати й працювати спокійніше.',
  },
]

export const DEFAULT_AUTHOR = 'eva-khudiuk'

export function getAuthor(slug: string | undefined): Author {
  return AUTHORS.find((a) => a.slug === (slug ?? DEFAULT_AUTHOR)) ?? AUTHORS[0]
}

export function authorPath(author: Author): string {
  return `/uk/autor/${author.slug}`
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}
