/**
 * Fine-grained per-gallery design overrides applied on top of a theme preset.
 * Every field is optional — an unset field inherits the theme's own token, so
 * the photographer only overrides what they want to tweak.
 */
export interface GalleryStyle {
  /** Accent colour (favorites, links, chips) — hex. */
  accent?: string
  /** Masonry column count on desktop. */
  columns?: number
  /** Corner radius in px for tiles and media. */
  radius?: number
  /** Display-font key (see FONT_PRESETS); the cover title font. */
  font?: string
  /**
   * Grid layout: masonry keeps every photo's real aspect ratio (default);
   * square / portrait crop tiles to a uniform 1:1 / 3:4 wall; collage is a
   * square wall where every 6th photo becomes a big 2×2 accent tile.
   */
  layout?: 'masonry' | 'square' | 'portrait' | 'collage'
  /** Cover focal point (0–100%); where the cover crop centres. */
  focalX?: number
  focalY?: number
}

/** Accent swatches offered in the designer (label + hex); '' = theme default. */
export const ACCENT_PRESETS: { value: string; label: string }[] = [
  { value: '', label: 'Тема' },
  { value: '#2f55ff', label: 'Синій' },
  { value: '#c8331f', label: 'Червоний' },
  { value: '#b8860b', label: 'Золотий' },
  { value: '#3f6f4f', label: 'Зелений' },
  { value: '#6b3f6b', label: 'Сливовий' },
  { value: '#26242a', label: 'Графіт' },
]

/** Display-font choices; '' = the theme's own display font. */
export const FONT_PRESETS: { value: string; label: string; family: string | null }[] = [
  { value: '', label: 'Тема', family: null },
  { value: 'serif', label: 'Серіф', family: 'Georgia, "Times New Roman", serif' },
  {
    value: 'sans',
    label: 'Ґротеск',
    family: '-apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
  },
  { value: 'mono', label: 'Моно', family: 'ui-monospace, "SF Mono", Menlo, monospace' },
]

/** Grid layouts: real proportions vs uniform crops. '' is not valid here —
 *  masonry IS the default, stored explicitly only when the user picked it. */
export const LAYOUT_CHOICES: {
  value: 'masonry' | 'square' | 'portrait' | 'collage'
  label: string
}[] = [
  { value: 'masonry', label: 'Мозаїка' },
  { value: 'square', label: 'Квадрати' },
  { value: 'portrait', label: 'Портрет 3:4' },
  { value: 'collage', label: 'Колаж' },
]

export const COLUMN_CHOICES = [2, 3, 4]
export const RADIUS_CHOICES: { value: number; label: string }[] = [
  { value: 0, label: 'Гострі' },
  { value: 10, label: 'Мʼякі' },
  { value: 22, label: 'Круглі' },
]

export function fontFamily(key: string | undefined): string | null {
  return FONT_PRESETS.find((f) => f.value === key)?.family ?? null
}

/** Tolerant parse of the jsonb column into a clean GalleryStyle. */
export function parseGalleryStyle(raw: unknown): GalleryStyle {
  if (!raw || typeof raw !== 'object') return {}
  const v = raw as Record<string, unknown>
  const style: GalleryStyle = {}
  if (typeof v.accent === 'string' && /^#[0-9a-fA-F]{6}$/.test(v.accent)) style.accent = v.accent
  if (typeof v.columns === 'number' && COLUMN_CHOICES.includes(v.columns)) style.columns = v.columns
  if (typeof v.radius === 'number' && RADIUS_CHOICES.some((r) => r.value === v.radius)) {
    style.radius = v.radius
  }
  if (typeof v.font === 'string' && FONT_PRESETS.some((f) => f.value === v.font && f.value)) {
    style.font = v.font
  }
  if (
    typeof v.layout === 'string' &&
    LAYOUT_CHOICES.some((l) => l.value === v.layout)
  ) {
    style.layout = v.layout as GalleryStyle['layout']
  }
  if (typeof v.focalX === 'number' && v.focalX >= 0 && v.focalX <= 100) style.focalX = v.focalX
  if (typeof v.focalY === 'number' && v.focalY >= 0 && v.focalY <= 100) style.focalY = v.focalY
  return style
}
