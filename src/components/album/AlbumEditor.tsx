'use client'

/**
 * Album editor: spreads list (left), the spread at screen size (centre),
 * templates / selected frame (right), film strip of gallery photos (bottom).
 * Works on previews only; originals are touched by the export alone. On a
 * phone it degrades to a read-only viewer.
 */
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { applyLayout, autoFillAlbum, autoFillSpread, buildSlots } from '@/lib/album/autofill'
import { backendFor, type LoadedProject } from '@/lib/album/backend'
import { MAX_ZOOM, dpiLevel, effectiveDpi, panFocal } from '@/lib/album/crop'
import { formatFor, sheetSizeMm } from '@/lib/album/geometry'
import { describeSpec } from '@/lib/album/profiles'
import { layoutCount, resolveLayout } from '@/lib/album/templates'
import { spreadLabel } from '@/lib/album/export/run'
import type { AlbumPhoto, AlbumSlot, AlbumSpread, PrintSpec } from '@/lib/album/types'
import { Uploader } from '@/components/Uploader'
import { ExportDialog } from './ExportDialog'
import { SlotInspector } from './SlotInspector'
import { DND_PHOTO, DND_SLOT, SpreadView, type SpreadViewHandlers } from './SpreadView'
import { TemplatePicker } from './TemplatePicker'
import { mapSpread, useAlbumDoc, type SaveStatus } from './useAlbumDoc'
import { btn, btnGhost, btnPrimary, label } from './ui'

const uuid = () => crypto.randomUUID()

function useIsPhone(): boolean {
  const [phone, setPhone] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const update = () => setPhone(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return phone
}

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const r = entry!.contentRect
      setSize({ width: r.width, height: r.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, size] as const
}

export function AlbumEditor({ backendKind, projectId, basePath }: { backendKind: 'server' | 'local'; projectId: string; basePath: string }) {
  const backend = backendFor(backendKind)
  const [loaded, setLoaded] = useState<LoadedProject | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    backend
      .loadProject(projectId)
      .then((data) => alive && setLoaded(data))
      .catch((e: Error) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [backend, projectId])

  if (error)
    return (
      <div className="p-10">
        <p className="text-red-700">{error}</p>
        <Link href={basePath} className="mt-4 inline-block text-sm underline">До альбомів</Link>
      </div>
    )
  if (!loaded) return <div className="p-10 text-muted">Завантажую альбом…</div>
  return <EditorInner backendKind={backendKind} basePath={basePath} loaded={loaded} />
}

const STATUS_TEXT: Record<SaveStatus, string> = {
  saved: 'Збережено',
  pending: 'Є зміни…',
  saving: 'Зберігаю…',
  error: 'Не збереглося',
}

function EditorInner({ backendKind, basePath, loaded }: { backendKind: 'server' | 'local'; basePath: string; loaded: LoadedProject }) {
  const backend = backendFor(backendKind)
  const { project: initial } = loaded
  const spec = initial.spec
  const doc = useAlbumDoc(backend, initial.id, initial.spreads)
  const { spreads, commit } = doc
  const [photos, setPhotos] = useState<AlbumPhoto[]>(loaded.photos)
  const photosById = useMemo(() => new Map(photos.map((p) => [p.id, p])), [photos])
  const [title, setTitle] = useState(initial.title)
  const [spreadId, setSpreadId] = useState<string | null>(initial.spreads[0]?.id ?? null)
  const [slotId, setSlotId] = useState<string | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const [showGuides, setShowGuides] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [stripFilter, setStripFilter] = useState<'all' | 'unused'>('all')
  const [rightTab, setRightTab] = useState<'templates' | 'frame'>('templates')
  const isPhone = useIsPhone()

  const current = spreads.find((s) => s.id === spreadId) ?? spreads[0] ?? null
  const currentIndex = current ? spreads.indexOf(current) : -1
  const selectedSlot = current?.slots.find((s) => s.id === slotId) ?? null

  useEffect(() => {
    if (!current && spreads.length) setSpreadId(spreads[0]!.id)
  }, [current, spreads])

  const usage = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of spreads) for (const slot of s.slots) if (slot.assetId) m.set(slot.assetId, (m.get(slot.assetId) ?? 0) + 1)
    return m
  }, [spreads])

  const lowDpiCount = useMemo(() => {
    let n = 0
    for (const s of spreads)
      for (const slot of s.slots) {
        const p = slot.assetId ? photosById.get(slot.assetId) : undefined
        if (p && dpiLevel(effectiveDpi(p.width, p.height, slot.w, slot.h, slot.zoom), spec.dpi) !== 'ok') n++
      }
    return n
  }, [spreads, photosById, spec.dpi])

  // ---- operations ---------------------------------------------------------

  const updateSlot = useCallback(
    (sid: string, slotKey: string, fn: (slot: AlbumSlot) => AlbumSlot, key?: string) =>
      commit((all) => mapSpread(all, sid, (s) => ({ ...s, slots: s.slots.map((x) => (x.id === slotKey ? fn(x) : x)) })), key),
    [commit]
  )

  const fillSlot = (slot: AlbumSlot, photo: AlbumPhoto): AlbumSlot => ({
    ...slot,
    assetId: photo.id,
    zoom: 1,
    fx: photo.focalX ?? 0.5,
    fy: photo.focalY ?? 0.5,
  })

  const addSpread = () => {
    const spread: AlbumSpread = { id: uuid(), kind: 'spread', layout: 'blank', slots: [] }
    commit((all) => {
      const at = currentIndex >= 0 ? currentIndex + 1 : all.length
      return [...all.slice(0, at), spread, ...all.slice(at)]
    })
    setSpreadId(spread.id)
    setSlotId(null)
  }

  const addCover = () => {
    if (spreads.some((s) => s.kind === 'cover')) return
    const cover: AlbumSpread = { id: uuid(), kind: 'cover', layout: 'blank', slots: [] }
    commit((all) => [cover, ...all])
    setSpreadId(cover.id)
  }

  const deleteSpread = (id: string) => {
    const idx = spreads.findIndex((s) => s.id === id)
    commit((all) => all.filter((s) => s.id !== id))
    const next = spreads[idx + 1] ?? spreads[idx - 1]
    setSpreadId(next && next.id !== id ? next.id : null)
    setSlotId(null)
  }

  const moveSpread = (id: string, dir: -1 | 1) =>
    commit((all) => {
      const i = all.findIndex((s) => s.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= all.length) return all
      if (all[i]!.kind === 'cover' || all[j]!.kind === 'cover') return all // cover stays first
      const next = [...all]
      ;[next[i], next[j]] = [next[j]!, next[i]!]
      return next
    })

  const setLayout = (layout: string) => {
    if (!current) return
    commit((all) => mapSpread(all, current.id, (s) => applyLayout(s, layout, spec, uuid)))
    setSlotId(null)
  }

  const autofillCurrent = () => {
    if (!current) return
    const unused = photos.filter((p) => !usage.has(p.id))
    const chosen = picked.length
      ? picked.map((id) => photosById.get(id)).filter((p): p is AlbumPhoto => !!p)
      : unused.slice(0, Math.max(layoutCount(current.layout), 3))
    if (!chosen.length) return
    const prev = spreads[currentIndex - 1]?.layout
    commit((all) => mapSpread(all, current.id, (s) => autoFillSpread(s, chosen, spec, uuid, prev)))
    setPicked([])
    setSlotId(null)
  }

  const autofillAlbum = () => {
    const pool = picked.length
      ? picked.map((id) => photosById.get(id)).filter((p): p is AlbumPhoto => !!p)
      : photos.filter((p) => !usage.has(p.id))
    if (!pool.length) return
    const created = autoFillAlbum(pool, spec, 3, uuid)
    commit((all) => {
      // Trailing empty spreads are placeholders — the auto-filled ones replace them.
      let end = all.length
      while (end > 0 && all[end - 1]!.kind === 'spread' && all[end - 1]!.slots.every((s) => !s.assetId)) end--
      return [...all.slice(0, end), ...created]
    })
    setPicked([])
    if (created[0]) setSpreadId(created[0].id)
  }

  const handlers: SpreadViewHandlers = useMemo(
    () => ({
      onSelectSlot: (id) => {
        setSlotId(id)
        if (id) setRightTab('frame')
      },
      onDropPhoto: (targetSlot, photoId) => {
        const photo = photosById.get(photoId)
        if (!photo || !current) return
        if (targetSlot) {
          updateSlot(current.id, targetSlot, (slot) => fillSlot(slot, photo))
          setSlotId(targetSlot)
          return
        }
        commit((all) =>
          mapSpread(all, current.id, (s) => {
            const empty = s.slots.find((x) => !x.assetId)
            if (empty) return { ...s, slots: s.slots.map((x) => (x === empty ? fillSlot(x, photo) : x)) }
            if (s.slots.length) return s
            // Empty spread: the photo becomes a full-bleed panorama.
            const layout = 'spread:pano-bleed'
            const rects = resolveLayout(layout, formatFor(spec, s.kind), { marginMm: spec.marginMm, gapMm: spec.gapMm })
            return { ...s, layout, slots: buildSlots(rects, [photo.id], photosById, uuid) }
          })
        )
      },
      onSwapSlots: (from, to) => {
        if (!current) return
        commit((all) =>
          mapSpread(all, current.id, (s) => {
            const a = s.slots.find((x) => x.id === from)
            const b = s.slots.find((x) => x.id === to)
            if (!a || !b) return s
            const pick = (x: AlbumSlot) => ({ assetId: x.assetId, zoom: x.zoom, fx: x.fx, fy: x.fy })
            return { ...s, slots: s.slots.map((x) => (x.id === from ? { ...x, ...pick(b) } : x.id === to ? { ...x, ...pick(a) } : x)) }
          })
        )
      },
      onPan: (id, dx, dy, gesture) => {
        if (!current) return
        updateSlot(
          current.id,
          id,
          (slot) => {
            const p = slot.assetId ? photosById.get(slot.assetId) : undefined
            if (!p) return slot
            const next = panFocal(p.width, p.height, slot.w, slot.h, slot.zoom, slot.fx, slot.fy, dx, dy)
            return { ...slot, ...next }
          },
          `pan-${gesture}`
        )
      },
      onZoom: (id, factor, gesture) => {
        if (!current) return
        updateSlot(current.id, id, (slot) => ({ ...slot, zoom: Math.min(Math.max(slot.zoom * factor, 1), MAX_ZOOM) }), `wheel-${gesture}`)
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [current?.id, photosById, commit, updateSlot, spec]
  )

  // ---- keyboard -----------------------------------------------------------

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, select, [contenteditable]')) return
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) doc.redo()
        else doc.undo()
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        doc.redo()
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && current && slotId) {
        e.preventDefault()
        updateSlot(current.id, slotId, (s) => ({ ...s, assetId: null, zoom: 1, fx: 0.5, fy: 0.5 }))
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const next = spreads[currentIndex + (e.key === 'ArrowRight' ? 1 : -1)]
        if (next) {
          setSpreadId(next.id)
          setSlotId(null)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [doc, current, slotId, spreads, currentIndex, updateSlot])

  const [stageRef, stage] = useElementSize<HTMLDivElement>()
  const sheet = current ? sheetSizeMm(formatFor(spec, current.kind)) : null
  const scale = sheet && stage.width > 0 ? Math.max(Math.min((stage.width - 40) / sheet.widthMm, (stage.height - 40) / sheet.heightMm), 0.05) : 0

  const refreshPhotos = async () => {
    try {
      setPhotos(await backend.refreshPhotos(initial.id))
    } catch {
      // keep the current strip
    }
  }

  // «Одразу розкласти фото» from the new-album form: ?auto=1, once.
  const autoDone = useRef(false)
  useEffect(() => {
    if (autoDone.current) return
    autoDone.current = true
    const url = new URL(window.location.href)
    if (url.searchParams.get('auto') !== '1') return
    url.searchParams.delete('auto')
    window.history.replaceState(null, '', url.toString())
    if (spreads.length === 0 && photos.length > 0) autofillAlbum()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const projectForExport = useMemo(() => ({ ...initial, title, spreads }), [initial, title, spreads])

  if (isPhone) return <PhoneViewer title={title} spec={spec} spreads={spreads} photos={photosById} basePath={basePath} />

  const stripPhotos = stripFilter === 'unused' ? photos.filter((p) => !usage.has(p.id)) : photos

  return (
    <div className="flex h-[100dvh] flex-col bg-[#ecebe8]" data-testid="album-editor">
      {/* -------- top bar -------- */}
      <header className="flex flex-none items-center gap-3 border-b border-line bg-white px-4 py-2">
        <Link href={basePath} className={btnGhost} aria-label="До альбомів">
          ←
        </Link>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title.trim() && backend.renameProject(initial.id, title).catch(() => undefined)}
          className="min-w-0 max-w-xs flex-1 rounded-lg border border-transparent px-2 py-1 font-display text-lg outline-none hover:border-line focus:border-fg"
          aria-label="Назва альбому"
        />
        <span className="hidden truncate text-xs text-muted xl:inline">{describeSpec(spec)}</span>
        <span
          className={`ml-auto text-xs font-semibold ${doc.status === 'error' ? 'text-red-700' : 'text-muted'}`}
          data-testid="save-status"
          data-status={doc.status}
          title={doc.error ?? undefined}
        >
          {STATUS_TEXT[doc.status]}
          {doc.status === 'error' && (
            <button className="ml-2 underline" onClick={() => void doc.saveNow()}>
              повторити
            </button>
          )}
        </span>
        {lowDpiCount > 0 && (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900" title="Фото, що дають менше DPI профілю">
            ⚠ {lowDpiCount} низький DPI
          </span>
        )}
        <button className={btnGhost} onClick={doc.undo} disabled={!doc.canUndo} aria-label="Скасувати" title="Скасувати (Ctrl+Z)">
          ↶
        </button>
        <button className={btnGhost} onClick={doc.redo} disabled={!doc.canRedo} aria-label="Повторити" title="Повторити (Ctrl+Shift+Z)">
          ↷
        </button>
        <label className="flex items-center gap-1.5 text-xs font-semibold text-muted">
          <input type="checkbox" checked={showGuides} onChange={(e) => setShowGuides(e.target.checked)} />
          Напрямні
        </label>
        <button className={btnPrimary} onClick={() => setExporting(true)} disabled={!spreads.length}>
          Експорт
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* -------- spreads list -------- */}
        <aside className="flex w-44 flex-none flex-col border-r border-line bg-white" aria-label="Розвороти">
          <div className="flex-1 overflow-y-auto p-2" data-testid="spread-list">
            {spreads.map((s, i) => {
              const f = sheetSizeMm(formatFor(spec, s.kind))
              const thumbScale = 136 / f.widthMm
              const active = s.id === current?.id
              return (
                <div key={s.id} className="mb-2">
                  <button
                    onClick={() => {
                      setSpreadId(s.id)
                      setSlotId(null)
                    }}
                    className={`block w-full rounded-md p-1 ${active ? 'bg-accent-soft ring-2 ring-fg' : 'hover:bg-bg'}`}
                    aria-label={spreadLabel(s, i, spreads)}
                    aria-current={active}
                    data-testid="spread-thumb"
                  >
                    <SpreadView spread={s} spec={spec} photos={photosById} scale={thumbScale} thumbs />
                  </button>
                  <div className="mt-0.5 flex items-center justify-between px-1">
                    <span className="whitespace-nowrap text-[11px] font-semibold text-muted">{spreadLabel(s, i, spreads)}</span>
                    {active && (
                      <span className="flex [&>button]:px-1.5">
                        <button className={btnGhost} onClick={() => moveSpread(s.id, -1)} aria-label="Перемістити вище" title="Вище">↑</button>
                        <button className={btnGhost} onClick={() => moveSpread(s.id, 1)} aria-label="Перемістити нижче" title="Нижче">↓</button>
                        <button
                          className={btnGhost}
                          onClick={() => {
                            if (s.slots.every((x) => !x.assetId) || window.confirm('Видалити розворот?')) deleteSpread(s.id)
                          }}
                          aria-label="Видалити розворот"
                          title="Видалити"
                        >
                          ✕
                        </button>
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex flex-col gap-1.5 border-t border-line p-2">
            <button className={btn} onClick={addSpread}>
              + Розворот
            </button>
            {!spreads.some((s) => s.kind === 'cover') && (
              <button className={btnGhost} onClick={addCover}>
                + Обкладинка
              </button>
            )}
          </div>
        </aside>

        {/* -------- stage -------- */}
        <main className="relative min-w-0 flex-1" ref={stageRef}>
          {current && scale > 0 ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <SpreadView
                spread={current}
                spec={spec}
                photos={photosById}
                scale={scale}
                showGuides={showGuides}
                selectedSlotId={slotId}
                handlers={handlers}
              />
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted">
              <p>У альбомі ще немає розворотів.</p>
              <div className="flex gap-2">
                <button className={btnPrimary} onClick={addSpread}>
                  + Перший розворот
                </button>
                <button className={btn} onClick={autofillAlbum} disabled={!photos.length}>
                  Автозаповнити альбом
                </button>
              </div>
            </div>
          )}
          {current && current.slots.length === 0 && (
            <p className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-sm text-muted">
              Оберіть шаблон праворуч, перетягніть фото на розворот або натисніть «Автозаповнити».
            </p>
          )}
        </main>

        {/* -------- right panel -------- */}
        <aside className="flex w-72 flex-none flex-col border-l border-line bg-white" aria-label="Панель">
          <div className="flex gap-1 border-b border-line p-2">
            <button
              className={`flex-1 rounded-full px-3 py-1 text-sm font-bold ${rightTab === 'templates' ? 'bg-fg text-white' : 'text-muted hover:text-fg'}`}
              onClick={() => setRightTab('templates')}
            >
              Шаблони
            </button>
            <button
              className={`flex-1 rounded-full px-3 py-1 text-sm font-bold ${rightTab === 'frame' ? 'bg-fg text-white' : 'text-muted hover:text-fg'}`}
              onClick={() => setRightTab('frame')}
            >
              Кадр
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {!current ? (
              <p className="text-sm text-muted">Додайте розворот.</p>
            ) : rightTab === 'templates' ? (
              <>
                <TemplatePicker spread={current} spec={spec} onApply={setLayout} />
                <div className="mt-4 flex flex-col gap-2 border-t border-line pt-3">
                  <p className={label}>Автозаповнення</p>
                  <button className={btn} onClick={autofillCurrent} disabled={!photos.length}>
                    Заповнити розворот {picked.length ? `обраними (${picked.length})` : 'наступними кадрами'}
                  </button>
                  <button className={btn} onClick={autofillAlbum} disabled={!photos.length}>
                    Розкласти {picked.length ? `обрані (${picked.length})` : 'невикористані'} по нових розворотах
                  </button>
                  <p className="text-xs text-muted">Позначте кадри в плівці клацанням — шаблон підбереться під їхню орієнтацію.</p>
                </div>
              </>
            ) : selectedSlot && current ? (
              <SlotInspector
                slot={selectedSlot}
                photo={selectedSlot.assetId ? photosById.get(selectedSlot.assetId) : undefined}
                spec={spec}
                onZoom={(zoom, key) => updateSlot(current.id, selectedSlot.id, (s) => ({ ...s, zoom }), key)}
                onFocal={(fx, fy) => updateSlot(current.id, selectedSlot.id, (s) => ({ ...s, fx, fy }))}
                onClear={() => updateSlot(current.id, selectedSlot.id, (s) => ({ ...s, assetId: null, zoom: 1, fx: 0.5, fy: 0.5 }))}
                onFitReset={() =>
                  updateSlot(current.id, selectedSlot.id, (s) => {
                    const p = s.assetId ? photosById.get(s.assetId) : undefined
                    return { ...s, zoom: 1, fx: p?.focalX ?? 0.5, fy: p?.focalY ?? 0.5 }
                  })
                }
              />
            ) : (
              <p className="text-sm text-muted">Клацніть по слоту на розвороті.</p>
            )}
          </div>
        </aside>
      </div>

      {/* -------- film strip -------- */}
      <footer
        className="flex-none border-t border-line bg-white"
        onDragOver={(e) => e.dataTransfer.types.includes(DND_SLOT) && e.preventDefault()}
        onDrop={(e) => {
          // A slot dragged back onto the strip gives its photo back.
          const from = e.dataTransfer.getData(DND_SLOT)
          if (from && current) updateSlot(current.id, from, (s) => ({ ...s, assetId: null, zoom: 1, fx: 0.5, fy: 0.5 }))
        }}
      >
        <div className="flex items-center gap-3 px-3 pt-2">
          <span className={label}>Фото · {photos.length}</span>
          <select
            value={stripFilter}
            onChange={(e) => setStripFilter(e.target.value as 'all' | 'unused')}
            className="rounded-full border border-line bg-white px-2 py-0.5 text-xs"
            aria-label="Фільтр плівки"
          >
            <option value="all">усі</option>
            <option value="unused">невикористані ({photos.filter((p) => !usage.has(p.id)).length})</option>
          </select>
          {picked.length > 0 && (
            <button className={btnGhost} onClick={() => setPicked([])}>
              зняти позначки ({picked.length})
            </button>
          )}
          <span className="ml-auto flex gap-2">
            {loaded.uploadGalleryId && (
              <button className={btn} onClick={() => setUploading(true)}>
                + Додати фото
              </button>
            )}
            {backendKind === 'server' && (
              <button className={btnGhost} onClick={refreshPhotos} title="Оновити плівку">
                ⟳
              </button>
            )}
          </span>
        </div>
        <div className="flex gap-2 overflow-x-auto px-3 pb-3 pt-2" data-testid="film-strip">
          {stripPhotos.length === 0 && (
            <p className="py-6 text-sm text-muted">
              {photos.length ? 'Усі фото вже в альбомі.' : 'Фото ще немає. Додайте їх кнопкою «Додати фото».'}
            </p>
          )}
          {stripPhotos.map((p) => {
            const isPicked = picked.includes(p.id)
            const used = usage.get(p.id) ?? 0
            return (
              <button
                key={p.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(DND_PHOTO, p.id)
                  e.dataTransfer.effectAllowed = 'copy'
                }}
                onClick={() => setPicked((all) => (all.includes(p.id) ? all.filter((x) => x !== p.id) : [...all, p.id]))}
                onDoubleClick={() => {
                  if (!current) return
                  const target = selectedSlot ?? current.slots.find((s) => !s.assetId)
                  handlers.onDropPhoto(target?.id ?? null, p.id)
                }}
                className={`relative h-20 flex-none overflow-hidden rounded-md bg-neutral-200 ${isPicked ? 'ring-4 ring-accent' : ''}`}
                style={{ width: Math.round((80 * p.width) / p.height) }}
                aria-label={`Фото ${p.name}${used ? ', уже в альбомі' : ''}`}
                aria-pressed={isPicked}
                data-testid="strip-photo"
                title={`${p.name} · ${p.width}×${p.height}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.thumbUrl || p.previewUrl} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover" />
                {used > 0 && (
                  <span className="absolute right-1 top-1 rounded-full bg-fg/80 px-1.5 text-[10px] font-bold text-white">✓{used > 1 ? used : ''}</span>
                )}
              </button>
            )
          })}
        </div>
      </footer>

      {exporting && (
        <ExportDialog
          project={projectForExport}
          photos={photos}
          currentSpreadId={current?.id ?? null}
          originalUrls={(ids) => backend.originalUrls(initial.id, ids)}
          beforeExport={doc.saveNow}
          onClose={() => setExporting(false)}
        />
      )}

      {uploading && loaded.uploadGalleryId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Додати фото">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6">
            <h2 className="font-display text-2xl">Додати фото до альбому</h2>
            <p className="mt-1 text-sm text-muted">Фото йдуть у неопубліковану галерею цього альбому (рахуються у ваше сховище).</p>
            <div className="mt-4">
              <Uploader
                galleryId={loaded.uploadGalleryId}
                dropHint="Перетягніть фото сюди або натисніть, щоб вибрати"
                videoPlanNotice="Відео в альбом не додаються."
                videoPlanLink="Тарифи"
                billingHref="/uk/dashboard/billing"
              />
            </div>
            <div className="mt-4 flex justify-end">
              <button
                className={btnPrimary}
                onClick={() => {
                  setUploading(false)
                  void refreshPhotos()
                }}
              >
                Готово
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PhoneViewer({
  title,
  spec,
  spreads,
  photos,
  basePath,
}: {
  title: string
  spec: PrintSpec
  spreads: AlbumSpread[]
  photos: Map<string, AlbumPhoto>
  basePath: string
}) {
  const [ref, size] = useElementSize<HTMLDivElement>()
  return (
    <div className="min-h-[100dvh] bg-[#ecebe8] px-4 py-5" data-testid="album-phone-viewer">
      <Link href={basePath} className="text-sm text-muted">
        ← Альбоми
      </Link>
      <h1 className="mt-2 font-display text-2xl">{title}</h1>
      <p className="mt-1 text-xs text-muted">{describeSpec(spec)}</p>
      <p className="mt-3 rounded-xl bg-white p-3 text-xs text-muted">На телефоні — лише перегляд. Верстати й експортувати зручно на ноутбуці.</p>
      <div ref={ref} className="mt-4 flex flex-col gap-5">
        {size.width > 0 &&
          spreads.map((s, i) => {
            const f = sheetSizeMm(formatFor(spec, s.kind))
            return (
              <figure key={s.id}>
                <SpreadView spread={s} spec={spec} photos={photos} scale={size.width / f.widthMm} plain />
                <figcaption className="mt-1 text-xs text-muted">{spreadLabel(s, i, spreads)}</figcaption>
              </figure>
            )
          })}
        {spreads.length === 0 && <p className="text-sm text-muted">Розворотів ще немає.</p>}
      </div>
    </div>
  )
}
