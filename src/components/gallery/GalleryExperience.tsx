'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { buildZipBlob, splitIntoParts, writeZipToStream, type ArchiveFile } from '@/lib/gallery/archive'
import { resolveGalleryTokens, type SiteMode, type ThemeId } from '@/lib/site/themes'
import { fontFamily, type GalleryStyle } from '@/lib/gallery/style'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'
import { isLocale, type Locale } from '@/lib/i18n/config'
import { LangPicker } from '@/components/LangPicker'
import { GalleryGrid, type GridTileInfo } from './GalleryGrid'
import { DeliveryBanner, deliveryVars } from './DeliveryStatusScreen'
import { gridSrc, gridSrcSet, rowDesktopHeight } from './gridLayout'
import type { GalleryLightboxProps } from './GalleryLightbox'
import s from './GalleryExperience.module.css'

// The viewer is a separate chunk: the grid renders without waiting for it, and
// it is fetched in the background once the page is idle.
const loadLightbox = () => import('./GalleryLightbox')
const GalleryLightbox = dynamic<GalleryLightboxProps>(loadLightbox, { ssr: false })

export interface GalleryItem {
  id: string
  kind: 'photo' | 'video'
  width: number | null
  height: number | null
  /** Full preview (2048 px JPEG) — the lightbox; for videos, the video itself. */
  previewUrl: string
  /**
   * Light grid tile (~1080 px WebP, the `mobile` variant). Missing on galleries
   * uploaded before it existed — the grid then uses previewUrl, as before.
   */
  gridUrl?: string | null
  /** MIME type of a video (the lightbox needs it for <source>). */
  contentType?: string | null
  /** Video still frame for the grid tile; null for photos or older videos. */
  posterUrl?: string | null
  /** Crop focus (0–100%) for uniform layouts; null = center. */
  focalX?: number | null
  focalY?: number | null
  downloadHref: string
}

export interface GalleryLabels {
  scrollHint: string
  selected: string
  downloadAll: string
  downloadHint: string
  preparingArchive: string
  archiveError: string
  /** 403 from the archive list when the photographer turned downloads off (0070). */
  downloadsDisabled?: string
  /** «Зберегти частину {i} з {n}» — shown when the archive comes in parts. */
  savePart: string
  downloadOriginal: string
  favoriteToggle: string
  madeOn: string
  tip: string
  /** «Слайд-шоу» button in the bar. */
  slideshow?: string
  contactPhotographer?: string
  /** Full-screen viewer controls (aria labels / tooltips). */
  viewer?: ViewerLabels
}

export interface ViewerLabels {
  lightbox: string
  close: string
  prev: string
  next: string
  play: string
  pause: string
  fullscreen: string
  exitFullscreen: string
  zoomIn: string
  zoomOut: string
  /** «{index} з {total}» */
  slideOf: string
}

const ENGLISH_VIEWER: ViewerLabels = {
  lightbox: 'Photo viewer',
  close: 'Close',
  prev: 'Previous',
  next: 'Next',
  play: 'Play',
  pause: 'Pause',
  fullscreen: 'Full screen',
  exitFullscreen: 'Exit full screen',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  slideOf: '{index} of {total}',
}

/* ---------- zero-egress zip: see src/lib/gallery/archive.ts ---------- */

/** Without a save-file stream each part lives in memory — keep it phone-sized. */
const PART_BYTES = 500 * 1024 * 1024

interface PartReady {
  index: number
  count: number
  /** Called from the tap: starts this part's download and builds the next. */
  save: () => void
}

function saveBlobUrl(url: string, name: string): void {
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  // Give the browser a moment to start reading before the memory is freed.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/* ---------- the experience ---------- */

export function GalleryExperience({
  locale,
  slug,
  title,
  eventLine,
  brandName,
  logoUrl,
  coverUrl,
  coverGridUrl = null,
  coverVideoUrl = null,
  items,
  initialFavorites,
  showBadge,
  tipUrl,
  contactUrl = null,
  theme,
  mode,
  labels,
  style,
  demo = false,
  deliveryNotice = null,
  downloadsEnabled = true,
}: {
  locale: string
  slug: string
  title: string
  eventLine: string | null
  brandName: string | null
  logoUrl: string | null
  coverUrl: string | null
  /** Light (~1080 px WebP) rendition of a photo cover, for phones. */
  coverGridUrl?: string | null
  /** When the cover asset is a video: a looping muted clip behind the title. */
  coverVideoUrl?: string | null
  items: GalleryItem[]
  initialFavorites: string[]
  showBadge: boolean
  tipUrl: string | null
  /** «Звʼязатися з фотографом» footer link (Instagram / site / mailto / tel). */
  contactUrl?: string | null
  theme: ThemeId
  mode: SiteMode
  labels: GalleryLabels
  /** Fine-grained per-gallery overrides on top of the theme tokens. */
  style?: GalleryStyle
  /** Public showcase: keep the interactions visual, never hit gallery APIs. */
  demo?: boolean
  /**
   * «Повна галерея в обробці · орієнтовно до …» strip above the cover — the
   * shoot is still in progress but some previews are already visible.
   */
  deliveryNotice?: { text: string; etaText: string | null } | null
  /**
   * «Клієнт може завантажувати фото» (0070). false — no «↓» on tiles, no
   * download in the viewer, no «Завантажити все» and no download hint; the
   * download routes answer 403 as well, so this is not the only guard.
   */
  downloadsEnabled?: boolean
}) {
  const tokens = resolveGalleryTokens(theme, mode)
  // Default accent: on «Опівніч» (night) the theme's own flame gold, so hearts
  // and the favourites pill match the site; light themes keep the cobalt.
  const accent = style?.accent ?? (mode === 'night' ? tokens.accent : '#2f55ff')
  const focal = `${style?.focalX ?? 50}% ${style?.focalY ?? 50}%`

  const [favorites, setFavorites] = useState<Set<string>>(new Set(initialFavorites))
  // Viewer: mounted on first open and kept, so closing can animate out.
  const [viewer, setViewer] = useState<{ open: boolean; index: number; slideshow: boolean } | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const coverRef = useRef<HTMLImageElement | null>(null)
  // Grid photos load right away when nothing is above the grid; under a
  // photo cover they are held until it has loaded (see renderTile).
  const coverIsPhoto = (style?.cover ?? 'classic') !== 'minimal' && !!coverUrl && !coverVideoUrl
  const [mediaReleased, setMediaReleased] = useState(!coverIsPhoto)
  useEffect(() => {
    if (mediaReleased) return
    const cover = coverRef.current
    const release = () => setMediaReleased(true)
    if (!cover || cover.complete) return release()
    cover.addEventListener('load', release)
    cover.addEventListener('error', release)
    // Never hold the grid hostage to a slow cover.
    const timer = window.setTimeout(release, 4000)
    return () => {
      cover.removeEventListener('load', release)
      cover.removeEventListener('error', release)
      window.clearTimeout(timer)
    }
  }, [mediaReleased])
  const [archive, setArchive] = useState<'idle' | 'working' | 'error' | 'disabled'>('idle')
  const [done, setDone] = useState(0)
  const [total, setTotal] = useState(0)
  const [partReady, setPartReady] = useState<PartReady | null>(null)

  async function toggleFavorite(assetId: string) {
    const selected = !favorites.has(assetId)
    setFavorites((prev) => {
      const next = new Set(prev)
      if (selected) next.add(assetId)
      else next.delete(assetId)
      return next
    })
    if (demo) return // showcase: keep the heart visual, never persist
    const response = await fetch(`/api/galleries/${slug}/selections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetId, kind: 'favorite', selected }),
    })
    if (!response.ok) {
      setFavorites((prev) => {
        const next = new Set(prev)
        if (selected) next.delete(assetId)
        else next.add(assetId)
        return next
      })
    }
  }

  async function downloadAll() {
    if (demo) return // showcase: no archive API in demo mode
    setArchive('working')
    setDone(0)
    setTotal(0)
    try {
      const listResponse = await fetch(`/api/galleries/${slug}/archive-urls`)
      if (listResponse.status === 403) {
        // Turned off by the photographer while this page was open.
        const body = (await listResponse.json().catch(() => null)) as { error?: string } | null
        if (body?.error === 'downloads_disabled') {
          setArchive('disabled')
          return
        }
      }
      if (!listResponse.ok) throw new Error('archive-urls')
      const { files } = (await listResponse.json()) as { files: ArchiveFile[] }
      setTotal(files.length)
      const onFileDone = () => setDone((previous) => previous + 1)

      if (window.showSaveFilePicker) {
        // Chromium on a computer: one zip streamed straight to disk.
        let handle: FileSystemFileHandle
        try {
          handle = await window.showSaveFilePicker({ suggestedName: `${slug}.zip` })
        } catch {
          setArchive('idle')
          return
        }
        const writable = await handle.createWritable()
        try {
          await writeZipToStream(files, writable, onFileDone)
        } catch (error) {
          await writable.abort().catch(() => {})
          throw error
        }
      } else {
        // Safari, Firefox, phones: parts of ~500 MB, one in memory at a time.
        const parts = splitIntoParts(files, PART_BYTES)
        for (let index = 0; index < parts.length; index++) {
          const blob = await buildZipBlob(parts[index], onFileDone)
          const url = URL.createObjectURL(blob)
          const name = parts.length === 1 ? `${slug}.zip` : `${slug}-${index + 1}.zip`
          if (parts.length === 1) {
            saveBlobUrl(url, name)
          } else {
            // A browser only lets a tap start a download, so every part waits
            // for its own tap (the save runs inside that tap's handler); the
            // next part is built only after that.
            await new Promise<void>((resume) =>
              setPartReady({
                index: index + 1,
                count: parts.length,
                save: () => {
                  saveBlobUrl(url, name)
                  resume()
                },
              })
            )
            setPartReady(null)
          }
        }
      }
      setArchive('idle')
    } catch {
      setArchive('error')
    }
  }

  const openAt = useCallback(
    (index: number) => setViewer({ open: true, index, slideshow: false }),
    []
  )

  const closeViewer = useCallback(
    () => setViewer((prev) => (prev ? { ...prev, open: false, slideshow: false } : prev)),
    []
  )

  const startSlideshow = useCallback(() => {
    if (items.length === 0) return
    setViewer({ open: true, index: 0, slideshow: true })
  }, [items.length])

  const onView = useCallback(
    (index: number) => setViewer((prev) => (prev && prev.index !== index ? { ...prev, index } : prev)),
    []
  )

  // Fetch the viewer's code once the page is idle, so the first tap opens it
  // without a network round trip.
  useEffect(() => {
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback
    const handle = idle ? idle(() => void loadLightbox()) : window.setTimeout(() => void loadLightbox(), 1500)
    return () => {
      if (!idle) window.clearTimeout(handle)
    }
  }, [])

  // Per-photo view tracking: record the opened/navigated-to photo once per
  // session (deduped) so the photographer sees which frames drew attention.
  const viewedRef = useRef<Set<string>>(new Set())
  const viewedIndex = viewer?.open ? viewer.index : null
  useEffect(() => {
    if (demo || viewedIndex === null) return
    const id = items[viewedIndex]?.id
    if (!id || viewedRef.current.has(id)) return
    viewedRef.current.add(id)
    void createSupabaseBrowserClient()
      .rpc('record_photo_view', { p_slug: slug, p_asset: id })
      .then(() => undefined, () => undefined)
  }, [viewedIndex, items, slug, demo])

  const vars = {
    '--g-bg': tokens.bg,
    '--g-fg': tokens.fg,
    '--g-mut': tokens.muted,
    '--g-line': tokens.line,
    '--g-accent': accent,
    '--g-display': fontFamily(style?.font) ?? tokens.fontDisplay,
    // The «system» font override covers body copy AND the caps labels.
    '--g-body': fontFamily(style?.bodyFont) ?? tokens.fontBody,
    '--g-label': fontFamily(style?.bodyFont) ?? tokens.fontLabel,
    '--g-display-transform': tokens.displayTransform,
    '--g-display-weight': String(tokens.displayWeight),
    '--g-display-tracking': tokens.displayTracking,
    '--g-cols': String(style?.columns ?? 3),
    '--g-radius': `${style?.radius ?? 10}px`,
    '--g-gap': `${style?.gap ?? 14}px`,
    '--g-tile': style?.layout === 'portrait' ? '3 / 4' : '1 / 1',
    // «Рядки»: desktop row height from the columns pick (phones/tablets: CSS).
    '--g-row-h-d': `${rowDesktopHeight(style?.columns ?? 3)}px`,
  } as React.CSSProperties

  // Cover treatment + title size come straight from the designer.
  const cover = style?.cover ?? 'classic'
  const titleSize = `calc(clamp(34px, 6vw, 68px) * ${(style?.titleScale ?? 100) / 100})`

  // Everything except masonry crops to a uniform wall: collage adds 2×2
  // accents on squares, editorial alternates wide hero rows with squares.
  const layout = style?.layout ?? 'masonry'
  // Per-photo crop focus only matters where tiles crop (uniform layouts);
  // masonry and «Рядки» show every photo whole.
  const tileFocus = (item: GalleryItem): React.CSSProperties | undefined =>
    layout !== 'masonry' && layout !== 'rows' && item.focalX != null
      ? { objectPosition: `${item.focalX}% ${item.focalY ?? 50}%` }
      : undefined
  const gridClass =
    layout === 'masonry'
      ? s.grid
      : layout === 'rows'
        ? `${s.grid} ${s.gridRows}`
        : `${s.grid} ${s.gridUniform}${
          layout === 'collage' ? ` ${s.gridCollage}` : layout === 'editorial' ? ` ${s.gridEditorial}` : ''
        }`

  const renderTile = (item: GalleryItem, index: number, tile: GridTileInfo) => {
    const media = (item.kind === 'photo' ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          // Same src/srcset/sizes on the server and after hydration: the
          // browser reuses the image it already has, nothing loads twice.
          src={gridSrc(item)}
          srcSet={gridSrcSet(item)}
          sizes={item.gridUrl ? tile.sizes : undefined}
          alt=""
          loading={tile.eager ? 'eager' : 'lazy'}
          fetchPriority={tile.priority ? 'high' : undefined}
          decoding={tile.eager ? undefined : 'async'}
          width={item.width ?? undefined}
          height={item.height ?? undefined}
          className={s.shotMedia}
          style={tileFocus(item)}
          onError={(event) => {
            const image = event.currentTarget
            // The light tile is missing (e.g. the CDN Worker isn't updated
            // yet): fall back to the full preview once.
            if (item.gridUrl && image.currentSrc !== item.previewUrl && !image.dataset.fallback) {
              image.dataset.fallback = ''
              image.removeAttribute('srcset')
              image.src = item.previewUrl
              return
            }
            // Storage refused the file (expired link, B2 cap): show the
            // empty tile rather than the browser's broken-image glyph.
            image.dataset.broken = ''
          }}
        />
      ) : item.posterUrl ? (
        // Video with a poster: show the still (never streams the original)
        // with a play badge; the real video opens in the lightbox.
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.posterUrl}
            alt=""
            loading={tile.eager ? 'eager' : 'lazy'}
            fetchPriority={tile.priority ? 'high' : undefined}
            decoding={tile.eager ? undefined : 'async'}
            className={s.shotMedia}
            style={tileFocus(item)}
          />
          <span className={s.playBadge}>▶</span>
        </>
      ) : (
        <video
          src={item.previewUrl}
          className={s.shotMedia}
          style={tileFocus(item)}
          muted
          playsInline
          preload="metadata"
        />
      ))
    return (
    <figure
      key={item.id}
      data-i={index}
      data-id={item.id}
      className={`${s.shot}${tile.fill ? ` ${s.shotFill}` : ''}${tile.contain ? ` ${s.shotContain}` : ''}`}
      // The proportions are known before the photo loads: the server-rendered
      // grid has its final layout, with a placeholder background, at once.
      style={
        tile.aspect
          ? ({
              aspectRatio: tile.aspect,
              // «Рядки»: the tile's share of its row (flex-grow ∝ width÷height).
              ...(tile.grow ? { '--r': String(tile.grow) } : {}),
            } as React.CSSProperties)
          : undefined
      }
      onClick={() => openAt(index)}
    >
      {
        // Under a photo cover the tiles' photos wait until the cover has
        // loaded, so the cover — the first thing a visitor sees — gets the
        // whole connection. Without JavaScript <noscript> shows them at once.
        mediaReleased ? media : <noscript>{media}</noscript>
      }
      {downloadsEnabled && (
        <a
          href={item.downloadHref}
          className={s.dlOne}
          title={labels.downloadOriginal}
          onClick={(event) => event.stopPropagation()}
        >
          ↓
        </a>
      )}
      <button
        type="button"
        aria-label={labels.favoriteToggle}
        aria-pressed={favorites.has(item.id)}
        className={`${s.heart} ${favorites.has(item.id) ? s.heartOn : ''}`}
        onClick={(event) => {
          event.stopPropagation()
          void toggleFavorite(item.id)
        }}
      >
        ♥
      </button>
    </figure>
    )
  }

  // Photos come from the media CDN (or presigned B2 URLs): open those
  // connections while the HTML is still being parsed.
  const mediaOrigins = Array.from(
    new Set(
      [coverUrl, items[0]?.gridUrl, items[0]?.previewUrl]
        .map((url) => (url && /^https?:\/\//.test(url) ? new URL(url).origin : null))
        .filter((origin): origin is string => !!origin)
    )
  ).slice(0, 2)

  return (
    <div ref={rootRef} className={s.root} style={vars}>
      {mediaOrigins.map((origin) => (
        <link key={origin} rel="preconnect" href={origin} />
      ))}
      {deliveryNotice && (
        <DeliveryBanner
          text={deliveryNotice.text}
          etaText={deliveryNotice.etaText}
          vars={deliveryVars(theme, mode, style)}
        />
      )}
      {/* -------- cover -------- */}
      <header className={`${s.cover}${cover === 'left' ? ` ${s.coverLeft}` : ''}${cover === 'minimal' ? ` ${s.coverMinimal}` : ''}`}>
        {cover !== 'minimal' &&
          (coverVideoUrl ? (
            <video
              className={s.coverImg}
              style={{ objectFit: 'cover', objectPosition: focal }}
              src={coverVideoUrl}
              poster={coverUrl ?? undefined}
              autoPlay
              muted
              loop
              playsInline
            />
          ) : coverUrl ? (
            // A real <img>, not a CSS background: the browser finds it in the
            // HTML at once and loads it first (it is the page's LCP element).
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={coverRef}
              className={s.coverImg}
              src={coverUrl}
              // Full-bleed hero: a phone (≤ 560 px, up to 3×) takes the light
              // 1080 px WebP; a tablet or computer screen takes the 2048 px preview.
              srcSet={coverGridUrl ? `${coverGridUrl} 1080w, ${coverUrl} 2048w` : undefined}
              sizes={coverGridUrl ? '(max-width: 560px) 360px, 100vw' : undefined}
              alt=""
              fetchPriority="high"
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: focal }}
            />
          ) : (
            <div className={s.coverImg} style={{ background: tokens.line }} />
          ))}
        {cover !== 'minimal' && <div className={s.coverShade} />}
        <div className={s.coverInner}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={brandName ?? ''} style={{ maxHeight: 40, width: 'auto' }} />
          ) : (
            brandName && <span className={s.caps}>{brandName}</span>
          )}
          <h1 className={s.coverTitle} style={{ fontSize: titleSize }}>{title}</h1>
          {eventLine && <span className={s.caps}>{eventLine}</span>}
        </div>
        {cover !== 'minimal' && (
          <span className={`${s.caps} ${s.scrollHint}`}>{labels.scrollHint}</span>
        )}
        {/* Language switcher: client galleries serve international guests too. */}
        <div
          className={s.caps}
          style={{
            position: 'absolute',
            top: 18,
            right: 20,
            zIndex: 2,
            maxWidth: 220,
            textAlign: 'right',
            color: cover === 'minimal' ? 'var(--g-mut)' : 'rgba(247, 244, 238, 0.9)',
          }}
        >
          <LangPicker current={isLocale(locale) ? locale : ('uk' as Locale)} />
        </div>
      </header>

      {/* -------- sticky bar -------- */}
      <div className={s.bar}>
        <span className={s.barName}>{title}</span>
        <span className={favorites.size > 0 ? s.selChipOn : s.selChip}>
          ♥ {favorites.size} {labels.selected}
        </span>
        {items.length > 0 && (
          <button type="button" className={s.slideBtn} onClick={startSlideshow}>
            ▶ {labels.slideshow ?? 'Slideshow'}
          </button>
        )}
        {!downloadsEnabled ? null : partReady ? (
          <button
            type="button"
            className={s.dlAll}
            onClick={() => partReady.save()}
          >
            {labels.savePart
              .replace('{i}', String(partReady.index))
              .replace('{n}', String(partReady.count))}
          </button>
        ) : (
          <button
            type="button"
            className={s.dlAll}
            disabled={archive === 'working'}
            onClick={() => void downloadAll()}
          >
            {archive === 'working'
              ? `${labels.preparingArchive} ${done}/${total || '…'}`
              : archive === 'disabled'
                ? (labels.downloadsDisabled ?? labels.archiveError)
                : archive === 'error'
                ? labels.archiveError
                : `${labels.downloadAll} · ${items.length}`}
          </button>
        )}
      </div>

      {/* download hint — so clients never have to ask how to save photos */}
      {downloadsEnabled && (
      <p
        style={{
          textAlign: 'center',
          fontSize: 13,
          lineHeight: 1.5,
          color: 'var(--g-mut)',
          margin: '14px 20px 0',
        }}
      >
        {labels.downloadHint}
      </p>
      )}

      {/* -------- grid (virtualized: only rows near the screen are in the DOM) -------- */}
      <GalleryGrid
        items={items}
        layout={layout}
        columns={style?.columns ?? 3}
        gap={style?.gap ?? 14}
        aboveFold={cover === 'minimal'}
        className={gridClass}
        renderTile={renderTile}
      />

      {/* -------- footer -------- */}
      <footer className={s.foot}>
        {brandName && <div className={s.sig}>{brandName}</div>}
        {(tipUrl || contactUrl) && (
          <div
            style={{
              marginTop: 18,
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: 10,
            }}
          >
            {contactUrl && (
              <a
                className={s.tipBtn}
                href={contactUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {labels.contactPhotographer ?? 'Contact the photographer'}
              </a>
            )}
            {tipUrl && (
              <a className={s.tipBtn} href={tipUrl} target="_blank" rel="noopener noreferrer">
                ♥ {labels.tip}
              </a>
            )}
          </div>
        )}
        {showBadge && (
          <a className={s.badge} href={`/${locale}`}>
            {labels.madeOn}
          </a>
        )}
      </footer>

      {/* -------- lightbox / slideshow -------- */}
      {viewer && (
        <GalleryLightbox
          items={items}
          open={viewer.open}
          index={viewer.index}
          slideshow={viewer.slideshow}
          favorites={favorites}
          labels={{ ...labels, viewer: labels.viewer ?? ENGLISH_VIEWER }}
          portalRoot={rootRef.current}
          onClose={closeViewer}
          onView={onView}
          onToggleFavorite={(id) => void toggleFavorite(id)}
          downloadsEnabled={downloadsEnabled}
        />
      )}
    </div>
  )
}
