/**
 * Print profiles: built-in examples (copy and edit), validation of a spec the
 * photographer typed in, and the DB row ↔ PrintSpec mapping.
 */
import type { ColorProfile, PrintProfile, PrintSpec } from './types'

export const DEFAULT_DPI = 300

/** Generic formats, not tied to a particular lab — the photographer copies one and adjusts. */
export const EXAMPLE_PROFILES: PrintProfile[] = [
  {
    id: 'example-30x30',
    name: 'Приклад: 30×30 см, обкладинка з корінцем',
    example: true,
    spec: {
      spreadWidthMm: 600,
      spreadHeightMm: 300,
      bleedMm: 3,
      safeMm: 8,
      marginMm: 12,
      gapMm: 4,
      dpi: DEFAULT_DPI,
      colorProfile: 'srgb',
      cover: { widthMm: 615, heightMm: 300, bleedMm: 15, spineMm: 15 },
    },
  },
  {
    id: 'example-40x30',
    name: 'Приклад: 40×30 см (альбомний)',
    example: true,
    spec: {
      spreadWidthMm: 800,
      spreadHeightMm: 300,
      bleedMm: 3,
      safeMm: 8,
      marginMm: 14,
      gapMm: 5,
      dpi: DEFAULT_DPI,
      colorProfile: 'adobe_rgb',
      cover: { widthMm: 818, heightMm: 300, bleedMm: 15, spineMm: 18 },
    },
  },
  {
    id: 'example-20x20',
    name: 'Приклад: 20×20 см (міні для батьків)',
    example: true,
    spec: {
      spreadWidthMm: 400,
      spreadHeightMm: 200,
      bleedMm: 3,
      safeMm: 5,
      marginMm: 8,
      gapMm: 3,
      dpi: DEFAULT_DPI,
      colorProfile: 'srgb',
      cover: null,
    },
  },
  {
    id: 'example-30x20',
    name: 'Приклад: 30×20 см (довільний)',
    example: true,
    spec: {
      spreadWidthMm: 600,
      spreadHeightMm: 200,
      bleedMm: 5,
      safeMm: 6,
      marginMm: 10,
      gapMm: 4,
      dpi: DEFAULT_DPI,
      colorProfile: 'srgb',
      cover: null,
    },
  },
]

const LIMITS = {
  spreadWidthMm: [50, 2000],
  spreadHeightMm: [50, 1000],
  bleedMm: [0, 20],
  safeMm: [0, 50],
  marginMm: [0, 100],
  gapMm: [0, 50],
  dpi: [72, 1200],
  coverWidthMm: [50, 2000],
  coverHeightMm: [50, 1000],
  coverBleedMm: [0, 50],
  spineMm: [0, 100],
} as const

const num = (v: unknown): number => (typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.')))
/** Empty form field → default. */
const or = (v: unknown, fallback: number): unknown => (v === undefined || v === null || v === '' ? fallback : v)

/** Validates and normalises a spec (same bounds as the DB checks in 0061). Throws a Ukrainian message. */
export function normalizeSpec(input: Partial<Record<keyof PrintSpec, unknown>> & { cover?: unknown }): PrintSpec {
  const check = (key: keyof typeof LIMITS, value: unknown, label: string): number => {
    const n = num(value)
    const [lo, hi] = LIMITS[key]
    if (!Number.isFinite(n) || n < lo || n > hi) throw new Error(`${label}: від ${lo} до ${hi}`)
    return Math.round(n * 10) / 10
  }
  const colorProfile: ColorProfile = input.colorProfile === 'adobe_rgb' ? 'adobe_rgb' : 'srgb'
  const spec: PrintSpec = {
    spreadWidthMm: check('spreadWidthMm', input.spreadWidthMm, 'Ширина розвороту, мм'),
    spreadHeightMm: check('spreadHeightMm', input.spreadHeightMm, 'Висота, мм'),
    bleedMm: check('bleedMm', or(input.bleedMm, 3), 'Виліт, мм'),
    safeMm: check('safeMm', or(input.safeMm, 5), 'Безпечне поле, мм'),
    marginMm: check('marginMm', or(input.marginMm, 10), 'Поля шаблонів, мм'),
    gapMm: check('gapMm', or(input.gapMm, 4), 'Відступ між фото, мм'),
    dpi: Math.round(check('dpi', or(input.dpi, DEFAULT_DPI), 'DPI')),
    colorProfile,
    cover: null,
  }
  const cover = input.cover as Partial<Record<'widthMm' | 'heightMm' | 'bleedMm' | 'spineMm', unknown>> | null | undefined
  if (cover && cover.widthMm !== undefined && cover.widthMm !== '' && cover.widthMm !== null) {
    spec.cover = {
      widthMm: check('coverWidthMm', cover.widthMm, 'Ширина обкладинки, мм'),
      heightMm: check('coverHeightMm', cover.heightMm, 'Висота обкладинки, мм'),
      bleedMm: check('coverBleedMm', or(cover.bleedMm, 15), 'Виліт обкладинки, мм'),
      spineMm: check('spineMm', or(cover.spineMm, 0), 'Корінець, мм'),
    }
    if (spec.cover.spineMm >= spec.cover.widthMm / 2) throw new Error('Корінець ширший за половину обкладинки')
  }
  if (spec.safeMm * 2 >= Math.min(spec.spreadWidthMm / 2, spec.spreadHeightMm)) {
    throw new Error('Безпечне поле займає всю сторінку')
  }
  return spec
}

/** album_print_profiles row (snake_case, numerics may come back as strings). */
export interface PrintProfileRow {
  id: string
  name: string
  spread_width_mm: number | string
  spread_height_mm: number | string
  bleed_mm: number | string
  safe_mm: number | string
  margin_mm: number | string
  gap_mm: number | string
  dpi: number
  color_profile: string
  cover_width_mm: number | string | null
  cover_height_mm: number | string | null
  cover_bleed_mm: number | string
  cover_spine_mm: number | string
}

export function profileFromRow(row: PrintProfileRow): PrintProfile {
  return {
    id: row.id,
    name: row.name,
    spec: {
      spreadWidthMm: Number(row.spread_width_mm),
      spreadHeightMm: Number(row.spread_height_mm),
      bleedMm: Number(row.bleed_mm),
      safeMm: Number(row.safe_mm),
      marginMm: Number(row.margin_mm),
      gapMm: Number(row.gap_mm),
      dpi: Number(row.dpi),
      colorProfile: row.color_profile === 'adobe_rgb' ? 'adobe_rgb' : 'srgb',
      cover:
        row.cover_width_mm !== null && row.cover_height_mm !== null
          ? {
              widthMm: Number(row.cover_width_mm),
              heightMm: Number(row.cover_height_mm),
              bleedMm: Number(row.cover_bleed_mm),
              spineMm: Number(row.cover_spine_mm),
            }
          : null,
    },
  }
}

export function rowFromSpec(name: string, spec: PrintSpec): Omit<PrintProfileRow, 'id'> {
  return {
    name,
    spread_width_mm: spec.spreadWidthMm,
    spread_height_mm: spec.spreadHeightMm,
    bleed_mm: spec.bleedMm,
    safe_mm: spec.safeMm,
    margin_mm: spec.marginMm,
    gap_mm: spec.gapMm,
    dpi: spec.dpi,
    color_profile: spec.colorProfile,
    cover_width_mm: spec.cover?.widthMm ?? null,
    cover_height_mm: spec.cover?.heightMm ?? null,
    cover_bleed_mm: spec.cover?.bleedMm ?? 15,
    cover_spine_mm: spec.cover?.spineMm ?? 0,
  }
}

/** «30×30 см · 300 DPI · sRGB» — page format, as photographers name albums. */
export function describeSpec(spec: PrintSpec): string {
  const cm = (mm: number) => (Math.round(mm) / 10).toString().replace('.', ',')
  const color = spec.colorProfile === 'adobe_rgb' ? 'Adobe RGB' : 'sRGB'
  return `${cm(spec.spreadWidthMm / 2)}×${cm(spec.spreadHeightMm)} см · виліт ${spec.bleedMm} мм · ${spec.dpi} DPI · ${color}`
}
