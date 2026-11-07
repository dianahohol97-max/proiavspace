import type { CSSProperties } from 'react'

/**
 * Phase 2 constructor: a theme is ONLY a set of token values — the blocks
 * (hero, portfolio, about, pricing, contact) are shared across all themes.
 * Switching a theme repaints and re-spaces the same content, never changes it.
 *
 * «Тиша» is the flagship; «Опівніч» is stored as the same theme with
 * mode: 'night' (catalog value 'opivnich' — kept for existing sites) and has
 * its own layout (components/site/midnight) on these night tokens.
 */

export const THEME_IDS = [
  'tysha',
  'povitria',
  'plivka',
  'zhurnal',
  'galereia',
  'arkhiv',
  'prodakshn',
] as const
export type ThemeId = (typeof THEME_IDS)[number]
export type SiteMode = 'light' | 'night'

export function isThemeId(value: string): value is ThemeId {
  return (THEME_IDS as readonly string[]).includes(value)
}

const SERIF = 'Georgia, "Times New Roman", serif'
const SANS = '-apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif'
const HELV = '"Helvetica Neue", Helvetica, Arial, sans-serif'
const MONO = 'ui-monospace, "SF Mono", "Cascadia Code", Consolas, monospace'

export interface ThemeTokens {
  bg: string
  fg: string
  muted: string
  accent: string
  line: string
  fontDisplay: string
  fontBody: string
  fontLabel: string
  radius: string
  /** Display-heading treatment — themes differ here, blocks stay shared. */
  displayTransform: 'none' | 'uppercase'
  displayWeight: number
  displayTracking: string
}

interface ThemeDef {
  id: ThemeId
  tokens: ThemeTokens
  /** Only «Тиша» ships a night inversion for now. */
  night?: ThemeTokens
}

const base: Omit<ThemeTokens, 'bg' | 'fg' | 'muted' | 'accent' | 'line'> = {
  fontDisplay: SERIF,
  fontBody: SANS,
  fontLabel: SANS,
  radius: '0px',
  displayTransform: 'none',
  displayWeight: 400,
  displayTracking: '0',
}

export const THEMES: Record<ThemeId, ThemeDef> = {
  tysha: {
    id: 'tysha',
    tokens: {
      ...base,
      bg: '#f2f1ed', fg: '#161513', muted: '#8a8781', accent: '#161513', line: '#dedcd5',
      fontLabel: MONO,
    },
    // «Опівніч»: warm near-black, candle ivory, muted flame gold. Contrast on
    // the background: fg ≈ 16:1, muted ≈ 7.4:1, accent ≈ 8.3:1 (all AA+).
    night: {
      ...base,
      bg: '#0d0b09', fg: '#efe6d6', muted: '#a89e8f', accent: '#c9a26a', line: '#2b251f',
      fontLabel: MONO,
    },
  },
  povitria: {
    id: 'povitria',
    tokens: {
      ...base,
      // «Повітря»: warm daylight paper, ink, a sky blue. On the paper: fg ≈ 15:1,
      // muted ≈ 5.4:1, sky ≈ 5.5:1 (AA).
      bg: '#fbfaf6', fg: '#1d2129', muted: '#636873', accent: '#3f6a92', line: '#e7e4dc',
    },
  },
  plivka: {
    id: 'plivka',
    tokens: {
      ...base,
      bg: '#f2efe6', fg: '#232a20', muted: '#6f7565', accent: '#c47a2e', line: '#ddd8c8',
      fontDisplay: 'Palatino, "Palatino Linotype", "Book Antiqua", Georgia, serif',
      fontLabel: MONO,
    },
  },
  zhurnal: {
    id: 'zhurnal',
    tokens: {
      ...base,
      // «Журнал»: cream paper, ink, editorial red. On the paper: fg ≈ 17:1,
      // muted ≈ 5.5:1, red ≈ 7.4:1 (AA).
      bg: '#fffdf8', fg: '#1c1a1d', muted: '#6b666c', accent: '#a8151a', line: '#e6e1d8',
    },
  },
  galereia: {
    id: 'galereia',
    tokens: {
      ...base,
      bg: '#ffffff', fg: '#111114', muted: '#86868c', accent: '#c8331f', line: '#e9e9ec',
      fontDisplay: HELV, fontBody: HELV,
      displayTransform: 'uppercase', displayWeight: 700, displayTracking: '-0.02em',
    },
  },
  arkhiv: {
    id: 'arkhiv',
    tokens: {
      ...base,
      bg: '#f5f2ea', fg: '#211f1c', muted: '#8c877c', accent: '#211f1c', line: '#dbd6c8',
      fontBody: SERIF, fontLabel: SERIF,
    },
  },
  prodakshn: {
    id: 'prodakshn',
    tokens: {
      ...base,
      bg: '#f1f1f0', fg: '#0e0e0e', muted: '#6d6d6b', accent: '#0e0e0e', line: '#0e0e0e',
      fontDisplay: HELV, fontBody: HELV,
      displayTransform: 'uppercase', displayWeight: 700, displayTracking: '-0.01em',
    },
  },
}

export function resolveTokens(theme: ThemeId, mode: SiteMode): ThemeTokens {
  const def = THEMES[theme]
  return mode === 'night' && def.night ? def.night : def.tokens
}

/**
 * Galleries keep the palettes they had before the site themes were redrawn
 * («Стилі галерей не змінюємо»): «Повітря» and «Журнал» site pages got new
 * accents, galleries do not. «Опівніч» gold was reviewed for galleries too.
 */
const GALLERY_FROZEN: Partial<Record<ThemeId, Pick<ThemeTokens, 'bg' | 'fg' | 'muted' | 'accent' | 'line'>>> = {
  povitria: { bg: '#fdfcfa', fg: '#1b1a1f', muted: '#8f8c94', accent: '#1b1a1f', line: '#e8e5df' },
  zhurnal: { bg: '#fffdf8', fg: '#26242a', muted: '#8f8b90', accent: '#26242a', line: '#e9e5dd' },
}

/** Tokens for gallery pages — the site tokens, minus the v2 site repaints. */
export function resolveGalleryTokens(theme: ThemeId, mode: SiteMode): ThemeTokens {
  const t = resolveTokens(theme, mode)
  const frozen = mode === 'light' ? GALLERY_FROZEN[theme] : undefined
  return frozen ? { ...t, ...frozen } : t
}

/** CSS custom properties consumed by the shared blocks. */
export function siteCssVars(theme: ThemeId, mode: SiteMode): CSSProperties {
  const t = resolveTokens(theme, mode)
  return {
    '--site-bg': t.bg,
    '--site-fg': t.fg,
    '--site-muted': t.muted,
    '--site-accent': t.accent,
    '--site-line': t.line,
    '--site-font-display': t.fontDisplay,
    '--site-font-body': t.fontBody,
    '--site-font-label': t.fontLabel,
    '--site-radius': t.radius,
    '--site-display-transform': t.displayTransform,
    '--site-display-weight': String(t.displayWeight),
    '--site-display-tracking': t.displayTracking,
  } as CSSProperties
}

/**
 * Gallery style resolution: per-gallery override → the photographer's site
 * theme (bundle looks seamless) → «Тиша». Gallery overrides use catalog
 * values, so «опівніч» works as a per-gallery choice too.
 */
export function resolveGalleryTheme(
  galleryTheme: string | null | undefined,
  siteTheme: string | null | undefined,
  siteMode: string | null | undefined
): { theme: ThemeId; mode: SiteMode } {
  if (galleryTheme) {
    const entry = THEME_CATALOG.find((item) => item.value === galleryTheme)
    if (entry) return { theme: entry.theme, mode: entry.mode }
  }
  if (siteTheme && isThemeId(siteTheme)) {
    return { theme: siteTheme, mode: siteMode === 'night' ? 'night' : 'light' }
  }
  return { theme: 'tysha', mode: 'light' }
}

/** Catalog entries shown in the editor: 8 items, «Опівніч» = tysha+night. */
export const THEME_CATALOG: { value: string; theme: ThemeId; mode: SiteMode }[] = [
  { value: 'tysha', theme: 'tysha', mode: 'light' },
  { value: 'opivnich', theme: 'tysha', mode: 'night' },
  { value: 'povitria', theme: 'povitria', mode: 'light' },
  { value: 'plivka', theme: 'plivka', mode: 'light' },
  { value: 'zhurnal', theme: 'zhurnal', mode: 'light' },
  { value: 'galereia', theme: 'galereia', mode: 'light' },
  { value: 'arkhiv', theme: 'arkhiv', mode: 'light' },
  { value: 'prodakshn', theme: 'prodakshn', mode: 'light' },
]
