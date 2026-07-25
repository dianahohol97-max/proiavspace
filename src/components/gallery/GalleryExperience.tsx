'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Zip, ZipPassThrough } from 'fflate'
import { resolveTokens, type SiteMode, type ThemeId } from '@/lib/site/themes'
import { fontFamily, type GalleryStyle } from '@/lib/gallery/style'
import { isLocale, type Locale } from '@/lib/i18n/config'
import { LangPicker } from '@/components/LangPicker'
import s from './GalleryExperience.module.css'

export interface GalleryItem {
  id: string
  kind: 'photo' | 'video'
  width: number | null
  height: number | null
  previewUrl: string
  /** Video still frame for the grid tile; null for photos or older videos. */
  posterUrl?: string | null
  downloadHref: string
}

export interface GalleryLabels {
  scrollHint: string
  selected: string
  downloadAll: string
  downloadHint: string
  preparingArchive: string
  archiveError: string
  downloadOriginal: string
  favoriteToggle: string
  madeOn: string
  tip: string
}

/* ---------- zero-egress zip (streams to disk on Chromium) ---------- */

interface ArchiveFile {
  name: string
  url: string
}

interface ZipSink {
  write(chunk: Uint8Array<ArrayBuffer>): Promise<void> | void
}

async function streamGalleryZip(
  files: ArchiveFile[],
  sink: ZipSink,
  onFileDone: () => void
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let writeChain: Promise<void> = Promise.resolve()
    const zip = new Zip((error, chunk, final) => {
      if (error) {
        reject(error)
        return
      }
      const copy = new Uint8Array(chunk.length)
      copy.set(chunk)
      writeChain = writeChain.then(() => sink.write(copy))
      if (final) writeChain.then(resolve, reject)
    })
    void (async () => {
      try {
        for (const file of files) {
          const entry = new ZipPassThrough(file.name)
          zip.add(entry)
          const response = await fetch(file.url)
          if (!response.ok || !response.body) throw new Error(`fetch ${file.name}`)
          const reader = response.body.getReader()
          for (;;) {
            const { done, value } = await reader.read()
            if (done) break
            entry.push(value)
          }
          entry.push(new Uint8Array(0), true)
          onFileDone()
        }
        zip.end()
      } catch (error) {
        reject(error instanceof Error ? error : new Error('zip failed'))
      }
    })()
  })
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
  items,
  initialFavorites,
  showBadge,
  tipUrl,
  theme,
  mode,
  labels,
  style,
  demo = false,
}: {
  locale: string
  slug: string
  title: string
  eventLine: string | null
  brandName: string | null
  logoUrl: string | null
  coverUrl: string | null
  items: GalleryItem[]
  initialFavorites: string[]
  showBadge: boolean
  tipUrl: string | null
  theme: ThemeId
  mode: SiteMode
  labels: GalleryLabels
  /** Fine-grained per-gallery overrides on top of the theme tokens. */
  style?: GalleryStyle
  /** Public showcase: keep the interactions visual, never hit gallery APIs. */
  demo?: boolean
}) {
  const tokens = resolveTokens(theme, mode)
  const accent = style?.accent ?? (mode === 'night' ? '#8fa2ff' : '#2f55ff')

  const [favorites, setFavorites] = useState<Set<string>>(new Set(initialFavorites))
  const [lightbox, setLightbox] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [archive, setArchive] = useState<'idle' | 'working' | 'error'>('idle')
  const [done, setDone] = useState(0)
  const [total, setTotal] = useState(0)
  const lbRef = useRef<HTMLDivElement | null>(null)
  const uk = locale === 'uk'

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
      if (!listResponse.ok) throw new Error('archive-urls')
      const { files } = (await listResponse.json()) as { files: ArchiveFile[] }
      setTotal(files.length)
      const onFileDone = () => setDone((previous) => previous + 1)

      if (window.showSaveFilePicker) {
        let handle: FileSystemFileHandle
        try {
          handle = await window.showSaveFilePicker({ suggestedName: `${slug}.zip` })
        } catch {
          setArchive('idle')
          return
        }
        const writable = await handle.createWritable()
        try {
          await streamGalleryZip(files, { write: (chunk) => writable.write(chunk) }, onFileDone)
          await writable.close()
        } catch (error) {
          await writable.abort().catch(() => {})
          throw error
        }
      } else {
        const chunks: Uint8Array<ArrayBuffer>[] = []
        await streamGalleryZip(files, { write: (chunk) => void chunks.push(chunk) }, onFileDone)
        const url = URL.createObjectURL(new Blob(chunks, { type: 'application/zip' }))
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = `${slug}.zip`
        anchor.click()
        URL.revokeObjectURL(url)
      }
      setArchive('idle')
    } catch {
      setArchive('error')
    }
  }

  const show = useCallback(
    (index: number) => setLightbox(((index % items.length) + items.length) % items.length),
    [items.length]
  )

  const closeViewer = useCallback(() => {
    setLightbox(null)
    setPlaying(false)
  }, [])

  const startSlideshow = useCallback(() => {
    if (items.length === 0) return
    setLightbox(0)
    setPlaying(true)
  }, [items.length])

  useEffect(() => {
    if (lightbox === null) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeViewer()
      if (event.key === 'ArrowLeft') show(lightbox - 1)
      if (event.key === 'ArrowRight') show(lightbox + 1)
      if (event.key === ' ') {
        event.preventDefault()
        setPlaying((p) => !p)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [lightbox, show, closeViewer])

  // Autoplay: advance photos on a timer; pause on a video so it can play out.
  useEffect(() => {
    if (!playing || lightbox === null) return
    if (items[lightbox]?.kind === 'video') return
    const timer = setTimeout(() => show(lightbox + 1), 4500)
    return () => clearTimeout(timer)
  }, [playing, lightbox, items, show])

  // Go fullscreen when a slideshow starts; stay there while paused; release it
  // only when the viewer closes.
  useEffect(() => {
    if (typeof document === 'undefined') return
    if (lightbox === null) {
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
      return
    }
    if (playing && lbRef.current && !document.fullscreenElement) {
      lbRef.current.requestFullscreen?.().catch(() => {})
    }
  }, [playing, lightbox])

  const vars = {
    '--g-bg': tokens.bg,
    '--g-fg': tokens.fg,
    '--g-mut': tokens.muted,
    '--g-line': tokens.line,
    '--g-accent': accent,
    '--g-display': fontFamily(style?.font) ?? tokens.fontDisplay,
    '--g-body': tokens.fontBody,
    '--g-label': tokens.fontLabel,
    '--g-display-transform': tokens.displayTransform,
    '--g-display-weight': String(tokens.displayWeight),
    '--g-display-tracking': tokens.displayTracking,
    '--g-cols': String(style?.columns ?? 3),
    '--g-radius': `${style?.radius ?? 10}px`,
  } as React.CSSProperties

  const current = lightbox !== null ? items[lightbox] : null

  return (
    <div className={s.root} style={vars}>
      {/* -------- cover -------- */}
      <header className={s.cover}>
        {coverUrl ? (
          <div className={s.coverImg} style={{ backgroundImage: `url("${coverUrl}")` }} />
        ) : (
          <div className={s.coverImg} style={{ background: tokens.line }} />
        )}
        <div className={s.coverShade} />
        <div className={s.coverInner}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={brandName ?? ''} style={{ maxHeight: 40, width: 'auto' }} />
          ) : (
            brandName && <span className={s.caps}>{brandName}</span>
          )}
          <h1 className={s.coverTitle}>{title}</h1>
          {eventLine && <span className={s.caps}>{eventLine}</span>}
        </div>
        <span className={`${s.caps} ${s.scrollHint}`}>{labels.scrollHint}</span>
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
            color: 'rgba(247, 244, 238, 0.9)',
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
            ▶ {uk ? 'Слайд-шоу' : 'Slideshow'}
          </button>
        )}
        <button
          type="button"
          className={s.dlAll}
          disabled={archive === 'working'}
          onClick={() => void downloadAll()}
        >
          {archive === 'working'
            ? `${labels.preparingArchive} ${done}/${total || '…'}`
            : archive === 'error'
              ? labels.archiveError
              : `${labels.downloadAll} · ${items.length}`}
        </button>
      </div>

      {/* download hint — so clients never have to ask how to save photos */}
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

      {/* -------- grid -------- */}
      <main className={s.grid}>
        {items.map((item, index) => (
          <figure
            key={item.id}
            className={s.shot}
            onClick={() => show(index)}
          >
            {item.kind === 'photo' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.previewUrl}
                alt=""
                loading="lazy"
                width={item.width ?? undefined}
                height={item.height ?? undefined}
                className={s.shotMedia}
              />
            ) : item.posterUrl ? (
              // Video with a poster: show the still (never streams the original)
              // with a play badge; the real video opens in the lightbox.
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.posterUrl} alt="" loading="lazy" className={s.shotMedia} />
                <span className={s.playBadge}>▶</span>
              </>
            ) : (
              <video src={item.previewUrl} className={s.shotMedia} muted playsInline preload="metadata" />
            )}
            <a
              href={item.downloadHref}
              className={s.dlOne}
              title={labels.downloadOriginal}
              onClick={(event) => event.stopPropagation()}
            >
              ↓
            </a>
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
        ))}
      </main>

      {/* -------- footer -------- */}
      <footer className={s.foot}>
        {brandName && <div className={s.sig}>{brandName}</div>}
        {tipUrl && (
          <div style={{ marginTop: 18 }}>
            <a className={s.tipBtn} href={tipUrl} target="_blank" rel="noopener noreferrer">
              ♥ {labels.tip}
            </a>
          </div>
        )}
        {showBadge && (
          <a className={s.badge} href={`/${locale}`}>
            {labels.madeOn}
          </a>
        )}
      </footer>

      {/* -------- lightbox / slideshow -------- */}
      {current && (
        <div
          ref={lbRef}
          className={s.lb}
          onClick={(event) => {
            if (event.target === event.currentTarget) closeViewer()
          }}
        >
          <div className={s.lbTools}>
            <button
              type="button"
              className={s.lbTool}
              aria-label={playing ? 'Pause' : 'Play'}
              onClick={() => setPlaying((p) => !p)}
            >
              {playing ? '⏸' : '▶'}
            </button>
            <button type="button" className={s.lbTool} aria-label="Close" onClick={closeViewer}>
              ✕
            </button>
          </div>
          <button type="button" className={s.lbPrev} onClick={() => show((lightbox ?? 0) - 1)}>
            ←
          </button>
          {current.kind === 'photo' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={current.previewUrl} alt="" className={s.lbMedia} />
          ) : (
            <video
              src={current.previewUrl}
              poster={current.posterUrl ?? undefined}
              className={s.lbMedia}
              controls
              autoPlay
              playsInline
            />
          )}
          <button type="button" className={s.lbNext} onClick={() => show((lightbox ?? 0) + 1)}>
            →
          </button>
          <div className={s.lbFoot}>
            <a href={current.downloadHref} className={s.lbDl}>
              ↓ {labels.downloadOriginal}
            </a>
            <span className={s.lbCap}>
              {(lightbox ?? 0) + 1} / {items.length}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
