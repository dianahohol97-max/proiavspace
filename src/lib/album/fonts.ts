/**
 * Fonts for album text (all with full Ukrainian Cyrillic, SIL OFL 1.1 —
 * public/album-fonts/README.md). The same TTF is used by the editor
 * (FontFace), the JPEG raster (canvas), the PDF (embedded subset) and named
 * in the PSD text layer by its PostScript name.
 */

export interface AlbumFont {
  id: string
  /** Shown in the font picker. */
  name: string
  /** CSS family registered via FontFace — unique, so it never clashes with site fonts. */
  family: string
  file: string
  postscriptName: string
  kind: 'serif' | 'sans' | 'script'
}

export const ALBUM_FONTS: AlbumFont[] = [
  { id: 'cormorant', name: 'Cormorant Garamond', family: 'AlbumCormorant', file: '/album-fonts/CormorantGaramond-Medium.ttf', postscriptName: 'CormorantGaramond-Medium', kind: 'serif' },
  { id: 'lora', name: 'Lora', family: 'AlbumLora', file: '/album-fonts/Lora-Regular.ttf', postscriptName: 'Lora-Regular', kind: 'serif' },
  { id: 'playfair', name: 'Playfair Display', family: 'AlbumPlayfair', file: '/album-fonts/PlayfairDisplay-Regular.ttf', postscriptName: 'PlayfairDisplay-Regular', kind: 'serif' },
  { id: 'montserrat', name: 'Montserrat', family: 'AlbumMontserrat', file: '/album-fonts/Montserrat-Regular.ttf', postscriptName: 'Montserrat-Regular', kind: 'sans' },
  { id: 'greatvibes', name: 'Great Vibes', family: 'AlbumGreatVibes', file: '/album-fonts/GreatVibes-Regular.ttf', postscriptName: 'GreatVibes-Regular', kind: 'script' },
  { id: 'marck', name: 'Marck Script', family: 'AlbumMarck', file: '/album-fonts/MarckScript-Regular.ttf', postscriptName: 'MarckScript-Regular', kind: 'script' },
]

export const DEFAULT_FONT_ID = 'cormorant'

export function fontById(id: string): AlbumFont {
  return ALBUM_FONTS.find((f) => f.id === id) ?? ALBUM_FONTS[0]!
}

/** CSS font shorthand for canvas/SVG at a size in px. */
export function cssFont(id: string, sizePx: number): string {
  return `${sizePx}px "${fontById(id).family}"`
}

type FontSet = { add(font: FontFace): void; load?: (font: string) => Promise<unknown> }

const loading = new Map<string, Promise<void>>()

/**
 * Registers and loads a font (document.fonts in the page, self.fonts in a
 * worker). `base` is the site origin when called from a worker.
 */
export function loadAlbumFont(id: string, base = ''): Promise<void> {
  const font = fontById(id)
  const key = `${base}|${font.id}`
  let p = loading.get(key)
  if (!p) {
    p = (async () => {
      const scope = globalThis as unknown as { fonts?: FontSet; document?: { fonts: FontSet } }
      const set = scope.document?.fonts ?? scope.fonts
      if (!set || typeof FontFace === 'undefined') throw new Error('FontFace API недоступний')
      const face = new FontFace(font.family, `url(${base}${font.file})`)
      await face.load()
      set.add(face)
    })()
    p.catch(() => loading.delete(key))
    loading.set(key, p)
  }
  return p
}

export function loadAlbumFonts(ids: Iterable<string>, base = ''): Promise<void[]> {
  return Promise.all([...new Set(ids)].map((id) => loadAlbumFont(id, base)))
}
