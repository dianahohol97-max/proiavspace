/** Shared shapes of the AI culling feature (stage 3). */

/** One photo the culling pass may look at — previews only, never originals. */
export interface CullingPhoto {
  id: string
  /** ~512 px rendition (thumb → mobile → preview), CORS-readable (CDN/presigned). */
  url: string
  /** Position in the gallery (upload/sort order). */
  order: number
  /** Capture time in ms, when known (EXIF). Null today: assets have no such column. */
  takenAt?: number | null
  /** Shown in the series view. */
  name?: string
  /** assets.hidden_from_client — the client does not see this photo. */
  hidden?: boolean
}

export interface FaceInfo {
  /** Face box width relative to the shorter image side (0..1). */
  size: number
  blinkLeft: number
  blinkRight: number
  /**
   * Face box in image fractions (0..1, top-left origin). Added for the album
   * «Магічна збірка» (focal point, hero frames); absent in analyses cached
   * before it — those are re-run when the album needs them.
   */
  x?: number
  y?: number
  w?: number
  h?: number
}

/** One dominant colour of a frame (CIE L*a*b*, D65) and its share of the pixels. */
export interface PaletteColor {
  l: number
  a: number
  b: number
  weight: number
}

/** Where the frame's crisp detail is: the main subject when there is no face. Fractions 0..1. */
export interface SubjectInfo {
  x: number
  y: number
  /** Share of the frame the crisp region covers (bounding box area, 0..1). */
  size: number
}

/** What the browser measured for one photo. Cached in IndexedDB. */
export interface PhotoAnalysis {
  /** Tile-based Laplacian variance (higher = sharper). */
  sharpness: number
  /** Whole-frame Laplacian variance (diagnostics). */
  globalSharpness: number
  /** 64-bit dHash as 16 hex chars. */
  hash: string
  /** Faces found by the landmarker; undefined = the eyes pass has not run. */
  faces?: FaceInfo[]
  /** Dominant colours (album colour harmony). Absent in analyses cached before it. */
  palette?: PaletteColor[]
  /** Crisp-detail centroid (album focal point when there is no face). Absent in older caches. */
  subject?: SubjectInfo
  /** The rendition could not be fetched/decoded. */
  error?: string
}

export type FlagKind = 'blurry' | 'duplicate' | 'eyes'

export interface PhotoVerdict {
  flags: FlagKind[]
  /** Series this photo belongs to (2+ frames), if any. */
  seriesId: string | null
  /** The sharpest frame of its series (or the photographer's pick). */
  bestInSeries: boolean
  /** Sharpness relative to comparable frames (1 = typical). Diagnostics/UI. */
  relativeSharpness: number | null
}

/**
 * The photographer's decision on a flagged frame. Nothing is ever hidden
 * automatically: 'confirmed' only means "yes, this is a reject" (the candidate
 * set for «Сховати від клієнта» once the hidden_from_client column exists),
 * 'cleared' removes the flag.
 */
export type Decision = 'confirmed' | 'cleared'

export interface CullingState {
  version: number
  galleryId: string
  analysis: Record<string, PhotoAnalysis>
  decisions: Record<string, Decision>
  /** Photographer-chosen best frame per series (seriesId → photo id). */
  bestOverrides: Record<string, string>
  /** Decisions were synced with the account at least once (0059): from then
   *  on the database is the source of truth, even when it is empty. */
  remoteSynced?: boolean
  updatedAt: number
}
