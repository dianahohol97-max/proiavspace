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
  // v2 one-page «візитка» themes (sites only; migration 0064)
  'start',
  'nizhnist',
  'kontent',
  'lyst',
  'portret',
  'sviato',
  'rozvorot',
  'indeks',
  'paspartu',
  'kontakt',
  'temna',
  'vydoshukach',
  'marshrut',
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
  start: {
    id: 'start',
    tokens: {
      ...base,
      // «Старт»: warm white, graphite, a brick-orange accent. On the paper:
      // fg ≈ 17:1, muted ≈ 6:1, accent ≈ 5:1 (AA).
      bg: '#f7f6f2', fg: '#17181b', muted: '#5b5f66', accent: '#b8461f', line: '#e3e1da',
      fontDisplay: '"Start Sans", "Start Sans Fallback", Arial, sans-serif',
    },
  },
  nizhnist: {
    id: 'nizhnist',
    tokens: {
      ...base,
      // «Ніжність»: milk white, warm ink, a dusty mauve that stays ≥ 4.5:1 on
      // every pastel of the theme (blush, mint, butter).
      bg: '#fbf6f3', fg: '#2e2629', muted: '#6d6266', accent: '#7d5160', line: '#ecdfdb',
      fontDisplay: '"Tender Round", "Tender Round Fallback", Arial, sans-serif',
    },
  },
  kontent: {
    id: 'kontent',
    tokens: {
      ...base,
      // «Контент»: app-white, ink, an electric indigo (7.4:1) and a lime
      // highlight used only behind dark text (16.7:1).
      bg: '#f3f3f0', fg: '#0f0f10', muted: '#5c5c63', accent: '#3a2fd6', line: '#e2e2dc',
      fontDisplay: '"Feed Sans", "Feed Sans Fallback", Arial, sans-serif',
    },
  },
  lyst: {
    id: 'lyst',
    tokens: {
      ...base,
      // «Лист»: letter paper, brown-black ink, blue fountain-pen ink (7.9:1);
      // no pinks, no hearts.
      bg: '#f4eee4', fg: '#2b2420', muted: '#6a5e55', accent: '#2e4a6b', line: '#e2d8ca',
      fontDisplay: '"Letter Hand", "Letter Hand Fallback", Georgia, serif',
    },
  },
  portret: {
    id: 'portret',
    tokens: {
      ...base,
      // «Портрет»: studio grey-white, graphite, a deep bottle green (7.2:1).
      bg: '#f6f6f4', fg: '#16191d', muted: '#596068', accent: '#1f5c4a', line: '#dfe1e0',
      fontDisplay: '"Studio Sans", "Studio Sans Fallback", Arial, sans-serif',
    },
  },
  sviato: {
    id: 'sviato',
    tokens: {
      ...base,
      // «Свято»: party cream, deep violet ink, tomato (5:1) and confetti
      // colours used behind dark text only.
      bg: '#fff8ef', fg: '#1d1a2b', muted: '#5f5a6e', accent: '#c23a26', line: '#efe3d2',
      fontDisplay: '"Party Sans", "Party Sans Fallback", Arial, sans-serif',
    },
  },
  rozvorot: {
    id: 'rozvorot',
    tokens: {
      ...base,
      // «Розворот»: quiet luxury — stone paper, warm black, bronze (5.5:1).
      bg: '#efebe4', fg: '#1e1c19', muted: '#665f55', accent: '#6f5b3e', line: '#ddd6cb',
      fontDisplay: '"Spread Serif", "Spread Serif Fallback", Georgia, serif',
    },
  },
  indeks: {
    id: 'indeks',
    tokens: {
      ...base,
      // «Індекс»: paper grey, near-black, signal red (5:1).
      bg: '#f1f1ee', fg: '#0b0b0b', muted: '#55555a', accent: '#c42d12', line: '#d9d9d4',
      fontDisplay: '"Index Grotesk", "Index Grotesk Fallback", Arial, sans-serif',
    },
  },
  paspartu: {
    id: 'paspartu',
    tokens: {
      ...base,
      // «Паспарту»: gallery wall white, ink, a muted museum blue (6.5:1).
      bg: '#f4f3f0', fg: '#1a1a1c', muted: '#5d5d63', accent: '#3b4f6b', line: '#dedcd6',
      fontDisplay: '"Mat Caps", "Mat Caps Fallback", Georgia, serif',
    },
  },
  kontakt: {
    id: 'kontakt',
    tokens: {
      ...base,
      // «Контакт»: photo paper, black, grease-pencil red (5:1).
      bg: '#efeee9', fg: '#121212', muted: '#56565a', accent: '#c4261a', line: '#d6d5cf',
      fontDisplay: '"Sheet Mono", "Sheet Mono Fallback", ui-monospace, monospace',
    },
  },
  temna: {
    id: 'temna',
    tokens: {
      ...base,
      // «Темна кімната»: darkroom black-red, print white, safelight red (7:1).
      bg: '#140707', fg: '#f1e6dc', muted: '#b9a89e', accent: '#ff6a57', line: '#3a1c18',
      fontDisplay: '"Lab Serif", "Lab Serif Fallback", Georgia, serif',
    },
    night: {
      ...base,
      bg: '#140707', fg: '#f1e6dc', muted: '#b9a89e', accent: '#ff6a57', line: '#3a1c18',
      fontDisplay: '"Lab Serif", "Lab Serif Fallback", Georgia, serif',
    },
  },
  vydoshukach: {
    id: 'vydoshukach',
    tokens: {
      ...base,
      // «Видошукач»: camera graphite, LCD white, AF amber (10.7:1).
      bg: '#0e1013', fg: '#eef0f2', muted: '#9aa1aa', accent: '#ffb340', line: '#23272d',
      fontDisplay: '"Finder Sans", "Finder Sans Fallback", Arial, sans-serif',
    },
    night: {
      ...base,
      bg: '#0e1013', fg: '#eef0f2', muted: '#9aa1aa', accent: '#ffb340', line: '#23272d',
      fontDisplay: '"Finder Sans", "Finder Sans Fallback", Arial, sans-serif',
    },
  },
  marshrut: {
    id: 'marshrut',
    tokens: {
      ...base,
      // «Маршрут»: map paper, deep spruce ink, route rust (4.9:1), forest green.
      bg: '#f3efe6', fg: '#1f2a2a', muted: '#56625f', accent: '#a44618', line: '#ddd5c4',
      fontDisplay: '"Route Sans", "Route Sans Fallback", Arial, sans-serif',
    },
  },
}

/**
 * v2 site themes are site styles only: a gallery of a photographer on one of
 * them keeps one of the existing gallery styles («Стилі галерей не змінюємо»).
 */
export const GALLERY_STYLE_OF: Partial<Record<ThemeId, { theme: ThemeId; mode: SiteMode }>> = {
  start: { theme: 'tysha', mode: 'light' },
  nizhnist: { theme: 'povitria', mode: 'light' },
  kontent: { theme: 'galereia', mode: 'light' },
  lyst: { theme: 'tysha', mode: 'light' },
  portret: { theme: 'galereia', mode: 'light' },
  sviato: { theme: 'tysha', mode: 'night' },
  rozvorot: { theme: 'tysha', mode: 'light' },
  indeks: { theme: 'prodakshn', mode: 'light' },
  paspartu: { theme: 'galereia', mode: 'light' },
  kontakt: { theme: 'arkhiv', mode: 'light' },
  temna: { theme: 'tysha', mode: 'night' },
  vydoshukach: { theme: 'tysha', mode: 'night' },
  marshrut: { theme: 'povitria', mode: 'light' },
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
    const entry = GALLERY_CATALOG.find((item) => item.value === galleryTheme)
    if (entry) return { theme: entry.theme, mode: entry.mode }
  }
  if (siteTheme && isThemeId(siteTheme)) {
    const mapped = GALLERY_STYLE_OF[siteTheme]
    if (mapped) return mapped
    return { theme: siteTheme, mode: siteMode === 'night' ? 'night' : 'light' }
  }
  return { theme: 'tysha', mode: 'light' }
}

/** Gallery styles (galleries.theme, CHECK in 0008): the original 8, «Опівніч» = tysha+night. */
export const GALLERY_CATALOG: { value: string; theme: ThemeId; mode: SiteMode }[] = [
  { value: 'tysha', theme: 'tysha', mode: 'light' },
  { value: 'opivnich', theme: 'tysha', mode: 'night' },
  { value: 'povitria', theme: 'povitria', mode: 'light' },
  { value: 'plivka', theme: 'plivka', mode: 'light' },
  { value: 'zhurnal', theme: 'zhurnal', mode: 'light' },
  { value: 'galereia', theme: 'galereia', mode: 'light' },
  { value: 'arkhiv', theme: 'arkhiv', mode: 'light' },
  { value: 'prodakshn', theme: 'prodakshn', mode: 'light' },
]

/**
 * Pre-v2 site themes that are no longer offered for sites. A site that still
 * has one renders with the nearest v2 theme, and the editor shows (and saves)
 * that theme. Their gallery styles stay as they were (GALLERY_CATALOG).
 */
export const LEGACY_SITE_THEME: Partial<Record<ThemeId, { theme: ThemeId; mode: SiteMode; value: string }>> = {
  plivka: { theme: 'kontakt', mode: 'light', value: 'kontakt' },
  arkhiv: { theme: 'kontakt', mode: 'light', value: 'kontakt' },
  galereia: { theme: 'paspartu', mode: 'light', value: 'paspartu' },
  prodakshn: { theme: 'indeks', mode: 'light', value: 'indeks' },
}

/** The theme a site actually renders with (legacy values → nearest v2 theme). */
export function resolveSiteTheme(theme: ThemeId, mode: SiteMode): { theme: ThemeId; mode: SiteMode } {
  const mapped = LEGACY_SITE_THEME[theme]
  return mapped ? { theme: mapped.theme, mode: mapped.mode } : { theme, mode }
}

/** Editor catalog value for a stored site theme (legacy → its replacement). */
export function siteCatalogValue(theme: string | null | undefined, mode: string | null | undefined): string {
  if (!theme) return 'tysha'
  if (theme === 'tysha' && mode === 'night') return 'opivnich'
  const mapped = isThemeId(theme) ? LEGACY_SITE_THEME[theme] : undefined
  return mapped ? mapped.value : theme
}

/** Site themes in the editor: the four kept originals plus the v2 «візитка» themes. */
export const THEME_CATALOG: { value: string; theme: ThemeId; mode: SiteMode }[] = [
  ...GALLERY_CATALOG.filter((entry) => !LEGACY_SITE_THEME[entry.theme]),
  { value: 'start', theme: 'start', mode: 'light' },
  { value: 'nizhnist', theme: 'nizhnist', mode: 'light' },
  { value: 'kontent', theme: 'kontent', mode: 'light' },
  { value: 'lyst', theme: 'lyst', mode: 'light' },
  { value: 'portret', theme: 'portret', mode: 'light' },
  { value: 'sviato', theme: 'sviato', mode: 'light' },
  { value: 'rozvorot', theme: 'rozvorot', mode: 'light' },
  { value: 'indeks', theme: 'indeks', mode: 'light' },
  { value: 'paspartu', theme: 'paspartu', mode: 'light' },
  { value: 'kontakt', theme: 'kontakt', mode: 'light' },
  { value: 'temna', theme: 'temna', mode: 'night' },
  { value: 'vydoshukach', theme: 'vydoshukach', mode: 'night' },
  { value: 'marshrut', theme: 'marshrut', mode: 'light' },
]
