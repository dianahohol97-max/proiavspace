/**
 * Search and sort for «Мої галереї» — pure, shared by the list component and
 * the audit tests.
 */
export type GallerySort = 'newest' | 'shoot' | 'updated' | 'title'
export const GALLERY_SORTS: readonly GallerySort[] = ['newest', 'shoot', 'updated', 'title']

export interface ListableGallery {
  title: string
  event_date: string | null
  created_at: string
  updated_at: string
}

export function parseGallerySort(value: unknown): GallerySort {
  return GALLERY_SORTS.includes(value as GallerySort) ? (value as GallerySort) : 'newest'
}

/** Case- and apostrophe-insensitive («Мар'яна» = «Марʼяна» = «марʼяна»). */
export function normalizeForSearch(text: string): string {
  return text
    .toLocaleLowerCase('uk')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ʼ'’`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function filterAndSortGalleries<T extends ListableGallery>(items: readonly T[], query: string, sort: GallerySort): T[] {
  const needle = normalizeForSearch(query)
  const words = needle ? needle.split(' ') : []
  const found = words.length
    ? items.filter((item) => {
        const hay = normalizeForSearch(item.title)
        return words.every((word) => hay.includes(word))
      })
    : [...items]
  const byDesc = (a: string | null, b: string | null) => (b ?? '').localeCompare(a ?? '')
  switch (sort) {
    case 'title':
      return found.sort((a, b) => a.title.localeCompare(b.title, 'uk', { sensitivity: 'base' }))
    case 'updated':
      return found.sort((a, b) => byDesc(a.updated_at, b.updated_at))
    case 'shoot':
      // Undated shoots go last, newest shoot first.
      return found.sort((a, b) =>
        a.event_date && b.event_date ? byDesc(a.event_date, b.event_date) : a.event_date ? -1 : b.event_date ? 1 : byDesc(a.created_at, b.created_at)
      )
    default:
      return found.sort((a, b) => byDesc(a.created_at, b.created_at))
  }
}
