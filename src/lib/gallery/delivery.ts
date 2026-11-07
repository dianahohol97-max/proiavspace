import type { GalleryDeliveryStatus } from '@/lib/types'

/**
 * «Статус зйомки для клієнта» (galleries.delivery_status / delivery_eta,
 * migration 0055). Pure logic only — shared by the public gallery page, the
 * dashboard control and the audit tests.
 */

export const DELIVERY_STATUSES: readonly GalleryDeliveryStatus[] = ['shot', 'editing', 'ready']

/** Anything outside the list (including '' and undefined) → null «без статусу». */
export function parseDeliveryStatus(value: unknown): GalleryDeliveryStatus | null {
  return typeof value === 'string' && (DELIVERY_STATUSES as readonly string[]).includes(value)
    ? (value as GalleryDeliveryStatus)
    : null
}

/** A real calendar date as YYYY-MM-DD (Postgres `date`), else null. */
export function parseDeliveryEta(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const [, y, m, d] = match.map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null
  return match[0]
}

/**
 * What the client sees at the gallery link (after the password / closed
 * checks, which always come first):
 *   - 'gallery' — the ordinary gallery, exactly as before (status null or 'ready');
 *   - 'screen'  — the status screen instead of an empty page ('shot'/'editing', no visible photos);
 *   - 'banner'  — the ordinary gallery with a small «в обробці» strip on top
 *                 ('shot'/'editing', some photos already visible).
 */
export type DeliveryView = 'gallery' | 'screen' | 'banner'

export function deliveryView(
  status: GalleryDeliveryStatus | null | undefined,
  visiblePhotoCount: number
): DeliveryView {
  if (status !== 'shot' && status !== 'editing') return 'gallery'
  return visiblePhotoCount > 0 ? 'banner' : 'screen'
}

/** Photos hidden from the client (assets.hidden_from_client, 0054) never count as «фото є». */
export function countVisibleAssets(assets: readonly { hidden_from_client?: boolean | null }[] | null | undefined): number {
  return (assets ?? []).filter((asset) => asset.hidden_from_client !== true).length
}

/** Step index on the «Зйомка → Обробка → Готово» line. */
export function deliveryStep(status: GalleryDeliveryStatus): 0 | 1 | 2 {
  return status === 'shot' ? 0 : status === 'editing' ? 1 : 2
}

function intlLocale(locale: string): string {
  return locale === 'uk' ? 'uk-UA' : locale === 'en' ? 'en-GB' : locale
}

/**
 * «14 грудня 2026» / «14 December 2026». The ETA is a calendar date with no
 * time zone, so it is formatted in UTC — never shifted to the day before.
 */
export function formatDeliveryEta(eta: string | null | undefined, locale: string): string | null {
  const valid = parseDeliveryEta(eta)
  if (!valid) return null
  const [y, m, d] = valid.split('-').map(Number)
  try {
    return new Intl.DateTimeFormat(intlLocale(locale), {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(y, m - 1, d)))
  } catch {
    return valid
  }
}

/* ---------- colours: readable in every gallery style ---------- */

type Rgb = [number, number, number]

function parseHex(hex: string): Rgb | null {
  const raw = hex.trim().replace(/^#/, '')
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw
  if (!/^[0-9a-f]{6}$/i.test(full)) return null
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as Rgb
}

function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`
}

function luminance([r, g, b]: Rgb): number {
  const lin = (v: number) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

/** WCAG 2.x contrast ratio of two hex colours (1…21). */
export function contrastRatio(a: string, b: string): number {
  const ca = parseHex(a)
  const cb = parseHex(b)
  if (!ca || !cb) return 1
  const [hi, lo] = [luminance(ca), luminance(cb)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** `from` moved `t` (0…1) of the way to `to`. */
export function mixHex(from: string, to: string, t: number): string {
  const a = parseHex(from)
  const b = parseHex(to)
  if (!a || !b) return from
  return toHex([0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t) as Rgb)
}

/**
 * `color` if it already reads on `bg` at `min`:1, else the least shift toward
 * `toward` (the theme's text colour) that does — so a theme's muted grey or a
 * pale accent keeps its hue but never drops below WCAG AA.
 */
export function ensureContrast(color: string, bg: string, toward: string, min = 4.5): string {
  if (contrastRatio(color, bg) >= min) return color
  for (let step = 1; step <= 20; step++) {
    const candidate = mixHex(color, toward, step / 20)
    if (contrastRatio(candidate, bg) >= min) return candidate
  }
  return toward
}

export interface DeliveryPalette {
  /** Page background (the theme's). */
  bg: string
  /** Main text. */
  fg: string
  /** Secondary text, ≥ 4.5:1 on both bg and surface. */
  muted: string
  /** Current step / highlights, ≥ 4.5:1 on bg and surface. */
  accent: string
  /** Text on an accent-filled dot. */
  onAccent: string
  /** Banner / card background: a faint tint of the text colour. */
  surface: string
  /** Hairlines and inactive step dots. */
  line: string
}

/**
 * Colours for the status screen and the banner, derived from the gallery's
 * own theme tokens (and the photographer's accent override, if any). Every
 * text colour is checked against both the page and the tinted surface.
 */
export function deliveryPalette(tokens: {
  bg: string
  fg: string
  muted: string
  line: string
  accent: string
}): DeliveryPalette {
  const { bg, fg } = tokens
  const surface = mixHex(bg, fg, 0.07)
  const readable = (color: string) => ensureContrast(ensureContrast(color, bg, fg), surface, fg)
  const accent = readable(tokens.accent)
  const onAccent = contrastRatio(bg, accent) >= contrastRatio('#ffffff', accent) ? bg : '#ffffff'
  return {
    bg,
    fg: readable(fg),
    muted: readable(tokens.muted),
    accent,
    onAccent,
    surface,
    line: mixHex(bg, fg, 0.18),
  }
}
