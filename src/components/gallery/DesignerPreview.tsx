'use client'

import { useEffect, useRef, useState } from 'react'
import { isLocale, localeLabels } from '@/lib/i18n/config'
import type { ThemeTokens } from '@/lib/site/themes'
import type { GridLayout } from './gridLayout'
import {
  PREVIEW_DEFAULT_FRAME,
  hasDimensions,
  masonryRatio,
  previewLanes,
  previewMetrics,
  previewRows,
  type PreviewDevice,
  type PreviewPhoto,
} from './previewLayout'

/** Client-gallery texts, in the photographer's language (dict.publicGallery). */
export interface PreviewClientLabels {
  scrollHint: string
  selected: string
  slideshow: string
  downloadAll: string
  downloadHint: string
}

/** Soft placeholders before the first upload: a mix of landscapes and portraits. */
const PLACEHOLDERS: PreviewPhoto[] = Array.from({ length: 9 }, (_, i) => ({
  id: `placeholder-${i}`,
  url: '',
  width: i % 3 === 0 ? 2 : 3,
  height: i % 3 === 0 ? 3 : 2,
}))

/**
 * The client gallery in miniature, inside a laptop (16:10) or phone (9:19.5)
 * frame. Every size is the client's at 1280 / 390 px, times one scale factor
 * (frame width ÷ screen width) — see previewLayout.ts. The frame scrolls: the
 * cover fills the same share of the screen as on the client, the photos are
 * below it.
 */
export function DesignerPreview({
  device,
  layout,
  columns,
  gap,
  radius,
  cover,
  titleScale,
  focalX,
  focalY,
  tokens,
  displayFont,
  bodyFont,
  labelFont,
  title,
  eventLine,
  brandName,
  logoUrl,
  coverUrl,
  photos,
  totalPhotos,
  downloadsEnabled,
  locale,
  labels,
  footerFallback,
}: {
  device: PreviewDevice
  layout: GridLayout
  columns: number
  gap: number
  radius: number
  cover: 'classic' | 'left' | 'minimal'
  titleScale: number
  focalX: number
  focalY: number
  tokens: ThemeTokens
  displayFont: string
  bodyFont: string
  labelFont: string
  title: string
  eventLine: string | null
  brandName: string | null
  logoUrl: string | null
  coverUrl: string | null
  photos: PreviewPhoto[]
  /** All frames the client sees (photos may hold only the first ones). */
  totalPhotos: number
  downloadsEnabled: boolean
  locale: string
  labels: PreviewClientLabels
  footerFallback: string
}) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [hostWidth, setHostWidth] = useState<number | null>(null)
  useEffect(() => {
    const host = hostRef.current
    if (!host || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => setHostWidth(entry.contentRect.width))
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  // Phone bezel: 6 px each side.
  const bezel = device === 'phone' ? 6 : 1
  const wanted = device === 'phone' ? PREVIEW_DEFAULT_FRAME.phone : 760
  const frameWidth = Math.max(
    160,
    Math.floor(Math.min(wanted, hostWidth != null ? hostWidth - 2 * bezel : PREVIEW_DEFAULT_FRAME[device]))
  )
  const m = previewMetrics({ device, layout, columns, gap, radius, titleScale, frameWidth })
  const k = m.scale
  const phone = device === 'phone'

  const shown = photos.length > 0 ? photos : PLACEHOLDERS
  const more = photos.length > 0 && totalPhotos > photos.length
  const count = photos.length > 0 ? totalPhotos : 0

  const caps = (color: string): React.CSSProperties => ({
    fontFamily: labelFont,
    fontSize: 10.5 * k,
    fontWeight: 700,
    letterSpacing: '0.22em',
    textTransform: 'uppercase',
    color,
  })
  const pill: React.CSSProperties = {
    flex: 'none',
    borderRadius: 999,
    fontFamily: labelFont,
    fontSize: 10.5 * k,
    fontWeight: 700,
    letterSpacing: '0.13em',
    textTransform: 'uppercase',
    color: tokens.fg,
    marginLeft: 'auto',
  }
  const focal = `${focalX}% ${focalY}%`

  /* ---------- one tile, as GalleryExperience renders it ---------- */
  const tile = (photo: PreviewPhoto, index: number, style: React.CSSProperties, fit: 'cover' | 'contain' = 'cover') => (
    <figure
      key={photo.id}
      data-i={index}
      data-id={photo.id}
      style={{
        position: 'relative',
        margin: 0,
        overflow: 'hidden',
        borderRadius: m.px.radius,
        background: 'rgba(127, 127, 127, 0.12)',
        ...style,
      }}
    >
      {photo.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo.url}
          alt=""
          loading="lazy"
          width={photo.width ?? undefined}
          height={photo.height ?? undefined}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            objectFit: fit,
            objectPosition:
              fit === 'cover' && photo.focalX != null ? `${photo.focalX}% ${photo.focalY ?? 50}%` : undefined,
          }}
        />
      ) : (
        <span
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            background: `linear-gradient(160deg, ${tokens.line}, ${tokens.muted})`,
            opacity: 0.6,
          }}
        />
      )}
      {/* «↓» and «♥»: always visible on touch screens, on hover on a computer */}
      {phone &&
        (downloadsEnabled ? ['↓', '♥'] : ['♥']).map((glyph, i, all) => (
          <span
            key={glyph}
            aria-hidden
            style={{
              position: 'absolute',
              top: 10 * k,
              right: (10 + 44 * (all.length - 1 - i)) * k,
              width: 36 * k,
              height: 36 * k,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              fontSize: (glyph === '↓' ? 14 : 15) * k,
              fontWeight: glyph === '↓' ? 800 : undefined,
              lineHeight: 1,
              background: `color-mix(in srgb, ${tokens.bg} 92%, transparent)`,
              color: tokens.fg,
              boxShadow: `0 ${3 * k}px ${12 * k}px rgba(0, 0, 0, 0.16)`,
            }}
          >
            {glyph}
          </span>
        ))}
    </figure>
  )

  /* ---------- the grid ---------- */
  let grid: React.ReactNode
  if (layout === 'rows') {
    const rows = previewRows(shown, m, more)
    grid = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: m.px.gap }}>
        {rows.map(({ row, widths }) => (
          <div
            key={row.start}
            data-row={row.start}
            style={{ display: 'flex', gap: m.px.gap, height: row.height }}
          >
            {shown.slice(row.start, row.end).map((photo, j) =>
              tile(
                photo,
                row.start + j,
                { flex: 'none', width: widths[j], height: '100%' },
                hasDimensions(photo.width, photo.height) ? 'cover' : 'contain'
              )
            )}
          </div>
        ))}
      </div>
    )
  } else if (layout === 'masonry') {
    const lanes = previewLanes(shown, m.columns)
    grid = (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: m.px.gap }}>
        {lanes.map((lane, laneIndex) => (
          <div
            key={laneIndex}
            data-lane={laneIndex}
            style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: m.px.gap }}
          >
            {lane.map((index) => {
              const photo = shown[index]
              return tile(
                photo,
                index,
                { aspectRatio: `1 / ${masonryRatio(photo.width, photo.height)}` },
                hasDimensions(photo.width, photo.height) ? 'cover' : 'contain'
              )
            })}
          </div>
        ))}
      </div>
    )
  } else {
    // Cropped layouts: the same CSS grid as .gridUniform / .gridCollage / .gridEditorial.
    const narrow = m.screen.width <= 900
    grid = (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${m.columns}, minmax(0, 1fr))`,
          gap: m.px.gap,
          gridAutoFlow: layout === 'collage' ? 'dense' : undefined,
        }}
      >
        {shown.map((photo, index) => {
          const n = index + 1 // :nth-child
          let style: React.CSSProperties = { aspectRatio: layout === 'portrait' ? '3 / 4' : '1 / 1' }
          if (layout === 'collage' && n % 6 === 1) style = { ...style, gridColumn: 'span 2', gridRow: 'span 2' }
          if (layout === 'editorial' && (n % 4 === 1 || n % 4 === 0)) {
            const alone = n % 4 === 1 && n === shown.length
            style = { gridColumn: 'span 2', aspectRatio: narrow ? '3 / 2' : alone ? '2 / 1' : 'auto' }
          }
          return tile(photo, index, style)
        })}
      </div>
    )
  }

  const coverPhoto = cover !== 'minimal'
  const fg = '#f7f4ee'

  return (
    <div ref={hostRef} className="flex w-full justify-center">
      <div
        className="shadow-[0_24px_60px_-32px_rgba(13,12,10,.45)]"
        style={{
          borderRadius: phone ? 30 : 12,
          border: phone ? `${bezel}px solid #1a1917` : `${bezel}px solid rgba(13,12,10,.12)`,
          overflow: 'hidden',
          background: tokens.bg,
        }}
      >
        <div
          data-testid="designer-preview"
          data-device={device}
          data-layout={layout}
          data-columns={m.columns}
          data-row-target={m.rowTarget}
          data-scale={k.toFixed(4)}
          className="[scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{
            width: m.frame.width,
            height: m.frame.height,
            overflowX: 'hidden',
            overflowY: 'auto',
            position: 'relative',
            background: tokens.bg,
            color: tokens.fg,
            fontFamily: bodyFont,
          }}
        >
          {/* -------- cover -------- */}
          <header
            data-testid="preview-cover"
            style={
              coverPhoto
                ? { position: 'relative', height: m.px.coverHeight, margin: m.px.coverMargin }
                : { position: 'relative' }
            }
          >
            {coverPhoto &&
              (coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={coverUrl}
                  alt=""
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: focal,
                    borderRadius: m.px.coverRadius,
                  }}
                />
              ) : (
                <div style={{ position: 'absolute', inset: 0, borderRadius: m.px.coverRadius, background: tokens.line }} />
              ))}
            {coverPhoto && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: m.px.coverRadius,
                  background: 'linear-gradient(180deg, rgba(0,0,0,.18), rgba(0,0,0,.32))',
                }}
              />
            )}
            <div
              style={{
                position: coverPhoto ? 'absolute' : 'static',
                inset: 0,
                zIndex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: cover === 'left' ? 'flex-start' : 'center',
                justifyContent: cover === 'left' ? 'flex-end' : 'center',
                textAlign: cover === 'left' ? 'left' : 'center',
                color: coverPhoto ? fg : tokens.fg,
                padding:
                  cover === 'left'
                    ? `${32 * k}px ${Math.min(48, Math.max(18, 0.04 * m.screen.width)) * k}px ${56 * k}px`
                    : cover === 'minimal'
                      ? `${Math.min(140, Math.max(72, 0.14 * m.screen.height)) * k}px ${24 * k}px ${36 * k}px`
                      : 24 * k,
              }}
            >
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt={brandName ?? ''} style={{ maxHeight: 40 * k, width: 'auto' }} />
              ) : (
                brandName && <span style={caps(coverPhoto ? 'rgba(247, 244, 238, 0.85)' : tokens.muted)}>{brandName}</span>
              )}
              <div
                data-testid="preview-title"
                style={{
                  fontFamily: displayFont,
                  fontWeight: tokens.displayWeight,
                  textTransform: tokens.displayTransform as React.CSSProperties['textTransform'],
                  letterSpacing: tokens.displayTracking,
                  margin: `${16 * k}px 0 ${12 * k}px`,
                  fontSize: m.px.titleSize,
                  lineHeight: 1.08,
                  textShadow: coverPhoto ? `0 ${2 * k}px ${50 * k}px rgba(0, 0, 0, 0.45)` : undefined,
                  textWrap: 'balance',
                } as React.CSSProperties}
              >
                {title}
              </div>
              {eventLine && (
                <span data-testid="preview-event" style={caps(coverPhoto ? 'rgba(247, 244, 238, 0.85)' : tokens.muted)}>
                  {eventLine}
                </span>
              )}
            </div>
            {coverPhoto && (
              <span
                style={{
                  ...caps('rgba(247, 244, 238, 0.8)'),
                  position: 'absolute',
                  bottom: 24 * k,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 1,
                  whiteSpace: 'nowrap',
                }}
              >
                {labels.scrollHint}
              </span>
            )}
            <span
              style={{
                ...caps(coverPhoto ? 'rgba(247, 244, 238, 0.9)' : tokens.muted),
                position: 'absolute',
                top: 18 * k,
                right: 20 * k,
                zIndex: 2,
              }}
            >
              {isLocale(locale) ? localeLabels[locale] : locale.toUpperCase()} ▾
            </span>
          </header>

          {/* -------- sticky bar -------- */}
          <div
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 3,
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: `${10 * k}px ${14 * k}px`,
              padding: `${11 * k}px ${m.px.padding}px`,
              background: `color-mix(in srgb, ${tokens.bg} 86%, transparent)`,
              backdropFilter: 'blur(14px)',
              borderBottom: `1px solid ${tokens.line}`,
            }}
          >
            {!phone && (
              <span
                style={{
                  flex: '1 1 auto',
                  minWidth: 0,
                  fontFamily: displayFont,
                  textTransform: tokens.displayTransform as React.CSSProperties['textTransform'],
                  fontSize: 15 * k,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {title}
              </span>
            )}
            <span
              style={{
                flex: 'none',
                borderRadius: 999,
                padding: `${6 * k}px ${13 * k}px`,
                fontSize: 12 * k,
                fontWeight: 700,
                border: `1px solid ${tokens.line}`,
                color: tokens.muted,
              }}
            >
              ♥ 0 {labels.selected}
            </span>
            {count > 0 && (
              <span style={{ ...pill, border: `1px solid ${tokens.line}`, padding: `${9 * k}px ${16 * k}px` }}>
                ▶ {labels.slideshow}
              </span>
            )}
            {downloadsEnabled && (
              <span
                data-testid="preview-download-all"
                style={{ ...pill, border: `1px solid ${tokens.fg}`, padding: `${9 * k}px ${18 * k}px` }}
              >
                {labels.downloadAll} · {count}
              </span>
            )}
          </div>
          {downloadsEnabled && (
            <p
              style={{
                textAlign: 'center',
                fontSize: 13 * k,
                lineHeight: 1.5,
                color: tokens.muted,
                margin: `${14 * k}px ${20 * k}px 0`,
              }}
            >
              {labels.downloadHint}
            </p>
          )}

          {/* -------- grid -------- */}
          <div
            data-testid="preview-grid"
            style={{ padding: `${24 * k}px ${m.px.padding}px ${8 * k}px` }}
          >
            {grid}
          </div>

          {/* -------- footer -------- */}
          <footer style={{ textAlign: 'center', padding: `${44 * k}px ${24 * k}px ${56 * k}px` }}>
            <div
              style={{
                fontFamily: displayFont,
                textTransform: tokens.displayTransform as React.CSSProperties['textTransform'],
                fontSize: 18 * k,
                color: brandName ? tokens.fg : tokens.muted,
              }}
            >
              {brandName ?? footerFallback}
            </div>
          </footer>
        </div>
      </div>
    </div>
  )
}
