/** Gallery page tabs: «Фото · Дизайн · Доступ · Клієнт» (?tab=). */
export const GALLERY_TABS = ['photos', 'design', 'access', 'client'] as const
export type GalleryTab = (typeof GALLERY_TABS)[number]

export function parseGalleryTab(value: unknown): GalleryTab {
  return GALLERY_TABS.includes(value as GalleryTab) ? (value as GalleryTab) : 'photos'
}
