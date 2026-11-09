/**
 * The designer's live preview («Дизайн» → Превʼю) is a scaled copy of the
 * client gallery (GalleryExperience + GalleryExperience.module.css) on a real
 * screen: a 1280 × 800 laptop (16:10) or a 390 × 844 iPhone (≈ 9:19.5).
 *
 * Nothing here has its own rules. Columns and row heights come from the very
 * same gridColumns() / rowTargetHeight() / justifyRows() / assignMasonryLanes()
 * the client grid uses, at the device's real width, and every pixel size is
 * then multiplied by one factor — frame width ÷ device width — so radius, gaps,
 * the cover and the type shrink together and the proportions stay the client's.
 */
import {
  assignMasonryLanes,
  gridColumns,
  hasDimensions,
  justifyRows,
  masonryRatio,
  rowAspect,
  rowTargetHeight,
  type GridLayout,
  type JustifiedRow,
} from './gridLayout'

export type PreviewDevice = 'desktop' | 'phone'

/** The screens the preview stands for (CSS px). */
export const PREVIEW_SCREENS: Record<PreviewDevice, { width: number; height: number }> = {
  // A typical laptop: 16:10.
  desktop: { width: 1280, height: 800 },
  // iPhone 12–15: 390 × 844 (≈ 9:19.5).
  phone: { width: 390, height: 844 },
}

/** Frame width (px) used before the preview has been measured (SSR). */
export const PREVIEW_DEFAULT_FRAME: Record<PreviewDevice, number> = { desktop: 640, phone: 300 }

/** At most this many photos travel to the preview (the client shows all). */
export const PREVIEW_PHOTO_LIMIT = 48

/** clamp(min, vw%, max) at a given viewport width, as CSS computes it. */
export function cssClamp(min: number, vw: number, max: number, viewportWidth: number): number {
  return Math.min(max, Math.max(min, (vw / 100) * viewportWidth))
}

/** Grid side padding: clamp(14px, 3vw, 32px) (`.grid`, `.bar`). */
export function pagePadding(viewportWidth: number): number {
  return cssClamp(14, 3, 32, viewportWidth)
}

/** The grid's content width on the client: max-width 1280 minus the padding. */
export function clientContentWidth(viewportWidth: number): number {
  return Math.min(viewportWidth, 1280) - 2 * pagePadding(viewportWidth)
}

/** Cover height on the client: `.cover { height: min(88vh, 760px) }`. */
export function clientCoverHeight(viewportHeight: number): number {
  return Math.min(0.88 * viewportHeight, 760)
}

/** Cover title size: clamp(34px, 6vw, 68px) × the designer's «Розмір заголовку». */
export function clientTitleSize(viewportWidth: number, titleScale: number): number {
  return cssClamp(34, 6, 68, viewportWidth) * (titleScale / 100)
}

export interface PreviewMetrics {
  device: PreviewDevice
  /** The real screen the preview stands for. */
  screen: { width: number; height: number }
  /** frame px per client px. */
  scale: number
  /** Frame size in px (16:10 laptop, 9:19.5 phone). */
  frame: { width: number; height: number }
  /** Columns the client grid has on that screen — gridColumns(). */
  columns: number
  /** «Рядки» target row height on that screen, client px — rowTargetHeight(). */
  rowTarget: number
  /** Client grid content width (1216 on the laptop, 362 on the phone). */
  contentWidth: number
  /** Everything below is already scaled to the frame. */
  px: {
    contentWidth: number
    padding: number
    gap: number
    radius: number
    rowTarget: number
    coverHeight: number
    coverMargin: number
    coverRadius: number
    titleSize: number
  }
}

export function previewMetrics(input: {
  device: PreviewDevice
  layout: GridLayout
  columns: number
  gap: number
  radius: number
  titleScale?: number
  /** Measured frame width; defaults to PREVIEW_DEFAULT_FRAME. */
  frameWidth?: number
}): PreviewMetrics {
  const screen = PREVIEW_SCREENS[input.device]
  const frameWidth = input.frameWidth && input.frameWidth > 0 ? input.frameWidth : PREVIEW_DEFAULT_FRAME[input.device]
  const scale = frameWidth / screen.width
  const columns = gridColumns(input.layout, input.columns, screen.width)
  const rowTarget = rowTargetHeight(input.columns, screen.width)
  const contentWidth = clientContentWidth(screen.width)
  return {
    device: input.device,
    screen,
    scale,
    frame: { width: frameWidth, height: frameWidth * (screen.height / screen.width) },
    columns,
    rowTarget,
    contentWidth,
    px: {
      contentWidth: contentWidth * scale,
      padding: pagePadding(screen.width) * scale,
      gap: input.gap * scale,
      radius: input.radius * scale,
      rowTarget: rowTarget * scale,
      coverHeight: clientCoverHeight(screen.height) * scale,
      coverMargin: 10 * scale,
      coverRadius: 16 * scale,
      titleSize: clientTitleSize(screen.width, input.titleScale ?? 100) * scale,
    },
  }
}

/* ---------- the photos ---------- */

export interface PreviewPhoto {
  id: string
  url: string
  width: number | null
  height: number | null
  focalX?: number | null
  focalY?: number | null
}

type AssetLike = {
  id: string
  position?: number | null
  created_at?: string | null
  hidden_from_client?: boolean | null
}

/**
 * What the client is shown, in the client's order: no «Сховано від клієнта»
 * frames, sorted by position then created_at (the client page's query), and
 * the cover — the chosen one if the client can see it, else the first frame
 * (the client page looks the cover up among visible frames only).
 */
export function clientVisible<T extends AssetLike>(
  assets: readonly T[],
  coverAssetId: string | null | undefined
): { visible: T[]; cover: T | null } {
  const visible = assets
    .filter((asset) => asset.hidden_from_client !== true)
    .map((asset, index) => ({ asset, index }))
    .sort((a, b) => {
      const pa = a.asset.position ?? 0
      const pb = b.asset.position ?? 0
      if (pa !== pb) return pa - pb
      const ca = a.asset.created_at ?? ''
      const cb = b.asset.created_at ?? ''
      if (ca !== cb) return ca < cb ? -1 : 1
      return a.index - b.index
    })
    .map(({ asset }) => asset)
  const cover = (coverAssetId && visible.find((asset) => asset.id === coverAssetId)) || visible[0] || null
  return { visible, cover }
}

/** A tile placed in the preview, in frame px. */
export interface PlacedRow {
  row: JustifiedRow
  /** Tile widths (frame px); the height is row.height. */
  widths: number[]
}

/**
 * «Рядки» in the frame: justifyRows() over the client's width, target and gap,
 * all scaled — the same row breaks as on the client screen. `more` = the
 * gallery has frames beyond the ones passed in: the final row here is not the
 * gallery's final row, so it is dropped rather than shown half-empty.
 */
export function previewRows(
  photos: readonly Pick<PreviewPhoto, 'width' | 'height'>[],
  metrics: PreviewMetrics,
  more: boolean
): PlacedRow[] {
  const aspects = photos.map((photo) => rowAspect(photo.width, photo.height))
  let rows = justifyRows(aspects, metrics.px.contentWidth, metrics.px.rowTarget, metrics.px.gap)
  if (more && rows.length > 1) rows = rows.slice(0, -1)
  return rows.map((row) => ({
    row,
    widths: aspects.slice(row.start, row.end).map((aspect) => aspect * row.height),
  }))
}

/** Masonry lanes, exactly as the client grid assigns them. */
export function previewLanes(
  photos: readonly Pick<PreviewPhoto, 'width' | 'height'>[],
  columns: number
): number[][] {
  return assignMasonryLanes(
    photos.map((photo) => masonryRatio(photo.width, photo.height)),
    columns
  ).lanes
}

export { hasDimensions, masonryRatio, rowAspect }
