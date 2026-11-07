import type { EmbeddedJpeg, FileKind } from './raw/extract'
import type { FaceInfo, PhotoAnalysis } from '@/lib/culling/types'

/** One photo in the chosen folder (a RAW, or a JPEG/HEIC without a RAW twin). */
export interface FolderItem {
  /** Relative path inside the chosen folder — unique, stable across reloads. */
  id: string
  name: string
  /** Relative directory ('' = the chosen folder itself). */
  dir: string
  kind: FileKind
  size: number
  lastModified: number
  /** A JPEG shot together with this RAW (RAW+JPEG): same dir and base name. */
  companion?: string
}

export interface ItemMeta {
  format: string
  /** Embedded JPEG used for analysis (null for JPEG/HEIC: the file itself). */
  preview: EmbeddedJpeg | null
  /** Largest embedded JPEG — the 100 % focus check. */
  full: EmbeddedJpeg | null
  /** Orientation to apply on top of what the decoder already does. */
  orientation: number
  takenAt: number | null
  /** Size of the analysed image as displayed (after orientation). */
  width: number
  height: number
  error?: string
}

/** The photographer's own marks — they always win over suggestions. */
export interface Mark {
  /** P = pick («залишити»), X = reject («брак»). */
  flag?: 'pick' | 'reject' | null
  stars?: number | null
}

export interface ExportSettings {
  /** Stars for the best frame of a series (0 = do not touch). */
  bestStars: number
  /** Colour label for rejects (Lightroom default label set, English names). '' = none. */
  rejectLabel: string
  /** Colour label for every frame of a series. '' = none. */
  seriesLabel: string
  /** Treat non-best frames of a series as rejects. */
  duplicatesAreRejects: boolean
  /** Write the Lightroom 13.2+ flag (xmpDM:pick) as well. */
  writePickFlag: boolean
}

export const DEFAULT_EXPORT: ExportSettings = {
  bestStars: 3,
  rejectLabel: 'Red',
  seriesLabel: '',
  duplicatesAreRejects: false,
  writePickFlag: true,
}

export interface FolderSession {
  version: number
  id: string
  folderName: string
  createdAt: number
  updatedAt: number
  items: FolderItem[]
  meta: Record<string, ItemMeta>
  analysis: Record<string, PhotoAnalysis>
  faces: Record<string, FaceInfo[]>
  marks: Record<string, Mark>
  bestOverrides: Record<string, string>
  settings: ExportSettings
  /** The folder came from the File System Access API (handle stored separately). */
  hasHandle: boolean
  exportedAt?: number
  /** What we wrote into each sidecar last time (to undo it if the decision changes). */
  written?: Record<string, Partial<Record<'rating' | 'label' | 'pick' | 'good', string>>>
  /** The sidecar's own values before our first write (null = the field was absent). */
  original?: Record<string, Partial<Record<'rating' | 'label' | 'pick' | 'good', string | null>>>
}
