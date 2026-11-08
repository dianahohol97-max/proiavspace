/**
 * Album builder (stage 1) — shared data shapes. Pure types: imported by the
 * editor (browser), the server actions and the unit tests alike.
 *
 * Units: every length is in millimetres, measured from the top-left corner of
 * the TRIM line (the finished, cut edge). Bleed lies outside it, so a
 * full-bleed slot has negative x/y and reaches past the trim width/height.
 */

export type ColorProfile = 'srgb' | 'adobe_rgb'
export type SpreadKind = 'cover' | 'spread'

/** Cover printed separately from the book block (full wrap: back + spine + front). */
export interface CoverSpec {
  /** Full wrap width at the base spine (spineMm): back + spine + front. */
  widthMm: number
  heightMm: number
  bleedMm: number
  /** Base spine width. */
  spineMm: number
  /**
   * Spine growth per spread (mm). 0/absent = fixed spine. The boards keep
   * their size, so the cover gets wider exactly by the spine growth.
   */
  spinePerSpreadMm?: number
}

/**
 * Print spec: a snapshot of a print profile, copied into the project at
 * creation (album_projects.spec), so editing the profile later never shifts
 * an album that is already laid out.
 */
export interface PrintSpec {
  /** Both pages together, trim size. */
  spreadWidthMm: number
  spreadHeightMm: number
  bleedMm: number
  safeMm: number
  /** Outer margin and gap between photos for templates «з відступами». */
  marginMm: number
  gapMm: number
  dpi: number
  colorProfile: ColorProfile
  /** null = the cover has the same format as a spread. */
  cover: CoverSpec | null
}

/** A print profile as the photographer edits it (album_print_profiles row, camelCased). */
export interface PrintProfile {
  id: string
  name: string
  spec: PrintSpec
  /** Built-in example (lives in code, copy to edit). */
  example?: boolean
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface AlbumSlot extends Rect {
  /** Client-side key only (the DB orders slots by position). */
  id: string
  assetId: string | null
  /** ≥ 1, multiplier on top of the «cover» fit. */
  zoom: number
  /** Focal point in image fractions (0..1): this point sits at the slot centre where the edges allow. */
  fx: number
  fy: number
  /** Rotation of the photo inside the slot, degrees clockwise (90° steps and free). Absent = 0. */
  rotation?: number
}

export type TextAlign = 'left' | 'center' | 'right'

/**
 * A line (or several, split by \n) of text. Point text, as in Photoshop: no
 * automatic wrapping, so the editor, the JPEG raster, the PDF text and the
 * PSD text layer break lines in exactly the same places.
 */
export interface AlbumText {
  id: string
  /** Anchor in trim-relative mm: left edge / centre / right edge of the first line's baseline, by align. */
  x: number
  y: number
  text: string
  /** Font id from src/lib/album/fonts.ts. */
  font: string
  sizePt: number
  /** #rrggbb */
  color: string
  align: TextAlign
  /** Degrees clockwise around the anchor: 0, 90 (spine, top to bottom), -90, 180. */
  rotation: number
  /** Baseline-to-baseline distance as a multiple of the size. */
  lineHeight: number
}

export interface AlbumSpread {
  id: string
  kind: SpreadKind
  /** Template id, see templates.ts (e.g. 'pages:p1-bleed|p2-v', 'spread:pano-bleed', 'blank'). */
  layout: string
  slots: AlbumSlot[]
  texts?: AlbumText[]
  /** Cover only: spine width (mm) this cover is laid out for. */
  spineMm?: number | null
}

/** A photo available to the album: previews for the editor, original size for DPI. */
export interface AlbumPhoto {
  id: string
  /** Original pixel size (orientation-corrected). */
  width: number
  height: number
  thumbUrl: string
  previewUrl: string
  name: string
  /** Gallery focal point (0..1) when the photographer set one. */
  focalX?: number | null
  focalY?: number | null
  /** Capture time (EXIF, assets.taken_at, ms) when known — the story order of «Магічна збірка». */
  takenAt?: number | null
  /** assets.hidden_from_client: never goes into an automatic album. */
  hidden?: boolean
  /** Client picks: hearts (favorite selections, any client) and retouch requests. */
  favorites?: number
  retouch?: boolean
}

export interface AlbumProjectSummary {
  id: string
  title: string
  galleryId: string | null
  spec: PrintSpec
  updatedAt: string
  spreadCount: number
}

export interface AlbumProject {
  id: string
  title: string
  galleryId: string | null
  spec: PrintSpec
  spreads: AlbumSpread[]
}
