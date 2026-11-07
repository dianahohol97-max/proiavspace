'use client'

/**
 * «Відбір із папки» — culling BEFORE editing, on the RAW files themselves.
 * Everything runs in this browser: the folder is read locally (only header
 * bytes + the embedded preview of each RAW), nothing is uploaded.
 */
import { useWindowVirtualizer } from '@tanstack/react-virtual'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { folderVerdicts, outcomeOf, type Outcome } from '@/lib/folder-cull/decide'
import { recordExport } from '@/lib/folder-cull/export'
import { fill, folderLabels, formatEta, type FolderLabels } from '@/lib/folder-cull/i18n'
import type { FolderProgress } from '@/lib/folder-cull/runner'
import {
  ensurePermission,
  hasDirectoryPicker,
  pickDirectory,
  scanFileList,
  scanHandle,
  sessionIdFor,
  type Scan,
} from '@/lib/folder-cull/source'
import {
  deleteSession,
  listSessions,
  loadHandle,
  loadSession,
  loadThumb,
  mergeSession,
  newSession,
  saveHandle,
  saveSession,
  saveThumb,
} from '@/lib/folder-cull/store'
import type { FolderItem, FolderSession, Mark } from '@/lib/folder-cull/types'
import type { PhotoVerdict } from '@/lib/culling/types'
import { CullViewer } from './CullViewer'
import { ExportPanel } from './ExportPanel'

type Filter = 'all' | 'reject' | 'best' | 'picked'
const TILE = 176
const GAP = 10

function supported() {
  return typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined'
}

/**
 * @param opfsFolder demo/e2e only: use this folder of the browser's private
 *   file system (OPFS) instead of the system folder picker — same handle API.
 */
export function FolderCull({ locale, opfsFolder }: { locale: string; opfsFolder?: string }) {
  const l = folderLabels(locale)
  const [session, setSession] = useState<FolderSession | null>(null)
  const scanRef = useRef<Scan | null>(null)
  const [recent, setRecent] = useState<FolderSession[]>([])
  const [scanning, setScanning] = useState(false)
  const [eyes, setEyes] = useState(true)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<FolderProgress | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [saved, setSaved] = useState<boolean | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [focus, setFocus] = useState(0)
  const [viewer, setViewer] = useState(false)
  const [zoom, setZoom] = useState(false)
  const [seriesOpen, setSeriesOpen] = useState<string | null>(null)
  const [thumbs, setThumbs] = useState<Map<string, string>>(new Map())
  const [canRun, setCanRun] = useState(true)
  const [fsApi, setFsApi] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const pendingRef = useRef<Partial<Pick<FolderSession, 'meta' | 'analysis' | 'faces'>>>({})
  const thumbBuf = useRef<Map<string, string>>(new Map())
  const gridRef = useRef<HTMLDivElement>(null)
  const [cols, setCols] = useState(4)

  useEffect(() => {
    setCanRun(supported())
    setFsApi(hasDirectoryPicker() || !!opfsFolder)
    listSessions().then(setRecent)
    return () => abortRef.current?.abort()
  }, [])

  // Debounced save of the session (measurements, marks, settings).
  // While the analysis runs the session changes every second; saving it (a
  // structured clone of thousands of entries) is spaced out.
  const lastSave = useRef(0)
  useEffect(() => {
    if (!session) return
    // At most every 10 s during the run (so a reload mid-run loses little), 0.8 s after edits otherwise.
    const wait = running ? Math.max(0, 10_000 - (Date.now() - lastSave.current)) : 800
    const t = setTimeout(() => {
      lastSave.current = Date.now()
      saveSession(session).then(setSaved)
    }, wait)
    return () => clearTimeout(t)
  }, [session, running])

  // Grid columns from the container width.
  useEffect(() => {
    const el = gridRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setCols(Math.max(2, Math.floor((el.clientWidth + GAP) / (TILE + GAP)))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [session])

  const openScan = useCallback(
    async (scan: Scan) => {
      scanRef.current = scan
      const id = sessionIdFor(scan.folderName)
      const merged = mergeSession(await loadSession(id), newSession(id, scan.folderName, scan.items, !!scan.handle))
      if (scan.handle) await saveHandle(id, scan.handle)
      setSession(merged)
      setFilter('all')
      setFocus(0)
      setNotice(null)
      setProgress(null)
      // Thumbnails of already analysed photos, from IndexedDB.
      const map = new Map<string, string>()
      await Promise.all(
        merged.items
          .filter((it) => merged.analysis[it.id])
          .map(async (it) => {
            const blob = await loadThumb(id, it.id)
            if (blob) map.set(it.id, URL.createObjectURL(blob))
          })
      )
      setThumbs(map)
    },
    []
  )

  const chooseFolder = async () => {
    const handle = opfsFolder
      ? await navigator.storage.getDirectory().then((root) => root.getDirectoryHandle(opfsFolder)).catch(() => null)
      : await pickDirectory()
    if (!handle) return
    setScanning(true)
    try {
      await openScan(await scanHandle(handle))
    } finally {
      setScanning(false)
    }
  }
  const chooseFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return
    setScanning(true)
    try {
      await openScan(scanFileList(list))
    } finally {
      setScanning(false)
    }
  }
  const resume = async (s: FolderSession) => {
    const handle = await loadHandle(s.id)
    if (!handle || !(await ensurePermission(handle, 'read'))) return
    setScanning(true)
    try {
      await openScan(await scanHandle(handle))
    } finally {
      setScanning(false)
    }
  }

  const flush = useCallback(() => {
    const p = pendingRef.current
    const t = thumbBuf.current
    if (!p.meta && !p.analysis && !p.faces && t.size === 0) return
    pendingRef.current = {}
    if (t.size) {
      const copy = new Map(t)
      thumbBuf.current = new Map()
      setThumbs((prev) => new Map([...prev, ...copy]))
    }
    setSession((s) =>
      s && {
        ...s,
        meta: { ...s.meta, ...p.meta },
        analysis: { ...s.analysis, ...p.analysis },
        faces: { ...s.faces, ...p.faces },
      }
    )
  }, [])

  const start = async () => {
    if (!session || !scanRef.current || running) return
    const controller = new AbortController()
    abortRef.current = controller
    setRunning(true)
    setNotice(null)
    const ticker = setInterval(flush, 1000)
    const id = session.id
    try {
      const { runFolder } = await import('@/lib/folder-cull/runner')
      await runFolder({
        items: session.items,
        files: scanRef.current.files,
        meta: session.meta,
        faces: session.faces,
        eyes,
        signal: controller.signal,
        onProcessed: (itemId, r) => {
          const p = pendingRef.current
          if (r.meta) p.meta = { ...p.meta, [itemId]: r.meta }
          if (r.analysis) p.analysis = { ...p.analysis, [itemId]: r.analysis }
          if (r.error && !r.meta) p.meta = { ...p.meta, [itemId]: { format: '', preview: null, full: null, orientation: 1, takenAt: null, width: 0, height: 0, error: r.error } }
          if (r.thumb) {
            thumbBuf.current.set(itemId, URL.createObjectURL(r.thumb))
            void saveThumb(id, itemId, r.thumb)
          }
        },
        onFaces: (itemId, faces) => {
          const p = pendingRef.current
          p.faces = { ...p.faces, [itemId]: faces }
        },
        onProgress: setProgress,
      })
      if (controller.signal.aborted) setNotice(l.cancelled)
    } finally {
      clearInterval(ticker)
      flush()
      setRunning(false)
      abortRef.current = null
    }
  }

  // ── Derived: order, verdicts, outcomes ─────────────────────────────────
  const { photos, verdicts } = useMemo(
    () => (session ? folderVerdicts(session) : { photos: [], verdicts: {} as Record<string, PhotoVerdict> }),
    [session]
  )
  const byId = useMemo(() => new Map(session?.items.map((it) => [it.id, it]) ?? []), [session?.items])
  const outcomes = useMemo(() => {
    const out = new Map<string, Outcome>()
    if (!session) return out
    for (const p of photos) out.set(p.id, outcomeOf(p.id, verdicts[p.id], session.marks[p.id], session.settings))
    return out
  }, [photos, verdicts, session])
  const series = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const p of photos) {
      const sid = verdicts[p.id]?.seriesId
      if (sid) m.set(sid, [...(m.get(sid) ?? []), p.id])
    }
    return m
  }, [photos, verdicts])

  const analysed = session ? photos.filter((p) => session.analysis[p.id]).length : 0
  const errors = session ? session.items.filter((it) => session.meta[it.id]?.error).length : 0
  const todo = session ? session.items.filter((it) => !session.meta[it.id] || (session.meta[it.id].error && session.meta[it.id].error !== 'heif-unsupported')).length : 0
  const facesTodo = session && eyes ? session.items.filter((it) => session.analysis[it.id] && !session.faces[it.id]).length : 0

  const visible = useMemo(() => {
    if (!session) return []
    return photos.filter((p) => {
      if (!session.analysis[p.id] && filter !== 'all') return false
      const o = outcomes.get(p.id)
      if (filter === 'reject') return o?.reject
      if (filter === 'best') return o?.best
      if (filter === 'picked') return session.marks[p.id]?.flag === 'pick'
      return true
    })
  }, [photos, outcomes, filter, session])
  const counts = useMemo(() => {
    let reject = 0
    let best = 0
    let picks = 0
    for (const p of photos) {
      const o = outcomes.get(p.id)
      if (o?.reject) reject++
      if (o?.best) best++
      if (session?.marks[p.id]?.flag === 'pick') picks++
    }
    return { reject, best, picks }
  }, [photos, outcomes, session?.marks])

  const setMark = useCallback((id: string, patch: Mark) => {
    setSession((s) => {
      if (!s) return s
      const next = { ...s.marks[id], ...patch }
      const marks = { ...s.marks }
      if (!next.flag && (next.stars === undefined || next.stars === null)) delete marks[id]
      else marks[id] = next
      return { ...s, marks }
    })
  }, [])

  const focused = visible[Math.min(focus, visible.length - 1)]

  // ── Keyboard (Photo Mechanic style) ────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!session || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return
      const id = focused?.id
      const k = e.key
      const move = (d: number) => {
        e.preventDefault()
        setFocus((f) => Math.max(0, Math.min(visible.length - 1, f + d)))
      }
      if (k === 'ArrowRight') return move(1)
      if (k === 'ArrowLeft') return move(-1)
      if (k === 'ArrowDown') return move(viewer ? 1 : cols)
      if (k === 'ArrowUp') return move(viewer ? -1 : -cols)
      if (k === 'Escape') {
        if (seriesOpen) setSeriesOpen(null)
        else if (viewer) {
          setViewer(false)
          setZoom(false)
        }
        return
      }
      if (!id) return
      const key = k.toLowerCase()
      if (key === 'p') setMark(id, { flag: 'pick' })
      else if (key === 'x') setMark(id, { flag: 'reject' })
      else if (key === 'u') setMark(id, { flag: null })
      else if (/^[0-5]$/.test(k)) setMark(id, { stars: Number(k) || null })
      else if (k === 'Enter' || k === ' ') {
        e.preventDefault()
        setViewer(true)
      } else if (key === 'z') {
        setViewer(true)
        setZoom((z) => (viewer ? !z : true))
      } else if (key === 's') {
        const sid = verdicts[id]?.seriesId
        if (sid) setSeriesOpen(sid)
      } else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [session, focused, visible.length, cols, viewer, seriesOpen, verdicts, setMark])

  // ── Virtualized grid (window scroll) ───────────────────────────────────
  const rows = Math.ceil(visible.length / cols)
  const virtualizer = useWindowVirtualizer({
    count: rows,
    estimateSize: () => TILE + 34 + GAP,
    overscan: 4,
    scrollMargin: gridRef.current?.offsetTop ?? 0,
  })
  useEffect(() => {
    if (!viewer && focused) virtualizer.scrollToIndex(Math.floor(focus / cols), { align: 'auto' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, cols])

  const getFile = useCallback(async () => scanRef.current!.files.get(focused!.id)!.getFile(), [focused])

  // ── Render ─────────────────────────────────────────────────────────────
  if (!session) {
    return (
      <section className="mt-8 max-w-3xl" data-testid="folder-cull">
        <p className="leading-relaxed text-muted">{l.intro}</p>
        <p className="mt-3 text-sm font-semibold">🔒 {l.privacy}</p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {fsApi && (
            <button type="button" onClick={chooseFolder} disabled={!canRun || scanning} className="border border-fg bg-fg px-6 py-2 text-sm uppercase tracking-widest text-bg hover:bg-transparent hover:text-fg disabled:opacity-50">
              {l.pick}
            </button>
          )}
          <label className={`cursor-pointer border px-5 py-2 text-sm ${fsApi ? 'border-line hover:border-fg' : 'border-fg bg-fg uppercase tracking-widest text-bg'}`}>
            {fsApi ? l.pickFiles : l.pick}
            <input
              type="file"
              multiple
              className="sr-only"
              data-testid="folder-input"
              disabled={!canRun || scanning}
              // React does not know these attributes.
              {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
              onChange={(e) => chooseFiles(e.target.files)}
            />
          </label>
        </div>
        <p className="mt-2 text-xs text-muted">{l.pickHint}</p>
        {scanning && <p className="mt-4 text-sm">{l.scanning}</p>}
        {recent.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">{l.resumeTitle}</h2>
            <ul className="mt-3 flex flex-col gap-2">
              {recent.slice(0, 6).map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-3 text-sm">
                  <span>{fill(l.resumeLine, { folder: s.folderName, done: Object.keys(s.analysis).length, total: s.items.length })}</span>
                  {s.hasHandle && fsApi && (
                    <button type="button" onClick={() => resume(s)} className="underline hover:text-accent">
                      {l.resumeOpen}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={async () => {
                      await deleteSession(s.id)
                      setRecent(await listSessions())
                    }}
                    className="text-muted underline hover:text-accent"
                  >
                    {l.resumeForget}
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted">{l.resumeHint}</p>
          </div>
        )}
      </section>
    )
  }

  const raws = session.items.filter((it) => it.kind === 'raw').length
  const skipped = scanRef.current?.skipped ?? 0
  const pct = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <section className="mt-6" data-testid="folder-cull">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-2xl">{session.folderName}</h2>
        <span className="text-sm text-muted" data-testid="cull-found">
          {fill(l.found, { n: session.items.length, raw: raws, other: session.items.length - raws, skipped: skipped ? fill(l.skipped, { n: skipped }) : '' })}
        </span>
        <span className="text-xs text-muted">{saved === false ? l.notSaved : `✓ ${l.saved}`}</span>
      </div>
      {session.items.length === 0 && <p className="mt-4 text-muted">{l.empty}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {running ? (
          <button type="button" onClick={() => abortRef.current?.abort()} className="border border-fg px-6 py-2 text-sm uppercase tracking-widest hover:bg-fg hover:text-bg">
            {l.cancel}
          </button>
        ) : (
          (todo > 0 || facesTodo > 0) && (
            <button type="button" onClick={start} disabled={!canRun} data-testid="cull-start" className="border border-fg bg-fg px-6 py-2 text-sm uppercase tracking-widest text-bg hover:bg-transparent hover:text-fg disabled:opacity-50">
              {analysed === 0 ? l.start : fill(l.continue, { n: todo || facesTodo })}
            </button>
          )
        )}
        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={eyes} disabled={running} onChange={(e) => setEyes(e.target.checked)} />
          {l.eyes}
        </label>
        <button type="button" onClick={() => { abortRef.current?.abort(); setSession(null); listSessions().then(setRecent) }} className="ml-auto text-sm text-muted underline hover:text-fg">
          ← {l.pick}
        </button>
      </div>

      {progress && (running || progress.stage !== 'done') && (
        <div className="mt-4" role="status" aria-live="polite" data-testid="cull-progress">
          <div className="flex flex-wrap justify-between gap-2 text-xs text-muted">
            <span>
              {progress.stage === 'process' ? l.stepProcess : progress.stage === 'model' ? l.stepModel : l.stepFaces} · {progress.done}/{progress.total}
              {progress.delegate ? ` · ${fill(l.delegate, { d: progress.delegate })}` : ''}
            </span>
            <span>{progress.paused ? l.paused : progress.etaMs ? fill(l.eta, { t: formatEta(progress.etaMs, l) }) : ''}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
            <div className="h-full bg-fg transition-[width] duration-300" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
      {progress?.facesError && <p className="mt-2 text-xs text-accent">{l.facesFailed}</p>}
      {notice && <p className="mt-2 text-xs text-muted">{notice}</p>}
      {errors > 0 && <p className="mt-2 text-xs text-muted">{fill(l.errors, { n: errors })}</p>}

      {analysed > 0 && (
        <>
          <p className="mt-5 text-sm" data-testid="cull-summary">
            {fill(l.summary, { ...counts, series: series.size })}
          </p>
          <ExportPanel
            session={session}
            scan={scanRef.current}
            outcomes={outcomes}
            order={photos}
            flagsOf={(id) => verdicts[id]?.flags ?? []}
            labels={l}
            onSettings={(settings) => setSession((s) => s && { ...s, settings })}
            onRecord={(written) => setSession((s) => s && recordExport(s, written))}
          />
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {(
              [
                ['all', l.filterAll, photos.length],
                ['reject', l.filterReject, counts.reject],
                ['best', l.filterBest, counts.best],
                ['picked', l.filterPicked, counts.picks],
              ] as const
            ).map(([key, label, n]) => (
              <button
                key={key}
                type="button"
                aria-pressed={filter === key}
                onClick={() => {
                  setFilter(key)
                  setFocus(0)
                }}
                className={`rounded-full border px-3 py-1 text-sm ${filter === key ? 'border-fg bg-fg text-bg' : 'border-line hover:border-fg'}`}
              >
                {label} · {n}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">{l.keys}</p>
        </>
      )}

      <div ref={gridRef} className="relative mt-4" style={{ height: virtualizer.getTotalSize() }} data-testid="cull-grid">
        {visible.length === 0 && analysed > 0 && <p className="text-sm text-muted">{l.emptyFilter}</p>}
        {virtualizer.getVirtualItems().map((row) => (
          <div
            key={row.key}
            className="absolute left-0 right-0 grid"
            style={{ top: row.start - virtualizer.options.scrollMargin, gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: GAP }}
          >
            {visible.slice(row.index * cols, row.index * cols + cols).map((p, i) => {
              const index = row.index * cols + i
              const item = byId.get(p.id)!
              return (
                <Tile
                  key={p.id}
                  item={item}
                  thumb={thumbs.get(p.id)}
                  verdict={verdicts[p.id]}
                  outcome={outcomes.get(p.id)}
                  mark={session.marks[p.id]}
                  error={session.meta[p.id]?.error}
                  seriesSize={verdicts[p.id]?.seriesId ? series.get(verdicts[p.id]!.seriesId!)?.length ?? 0 : 0}
                  focused={index === focus}
                  labels={l}
                  onFocus={() => setFocus(index)}
                  onOpen={() => {
                    setFocus(index)
                    setViewer(true)
                  }}
                  onSeries={() => setSeriesOpen(verdicts[p.id]?.seriesId ?? null)}
                />
              )
            })}
          </div>
        ))}
      </div>

      {viewer && focused && byId.get(focused.id) && (
        <CullViewer
          item={byId.get(focused.id)!}
          meta={session.meta[focused.id]}
          getFile={getFile}
          labels={l}
          zoom={zoom}
          onZoom={setZoom}
          onClose={() => {
            setViewer(false)
            setZoom(false)
          }}
          overlay={<Marks verdict={verdicts[focused.id]} outcome={outcomes.get(focused.id)} mark={session.marks[focused.id]} labels={l} />}
        />
      )}
      {seriesOpen && series.get(seriesOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" onClick={() => setSeriesOpen(null)} data-testid="cull-series">
          <div className="max-h-full w-full max-w-6xl overflow-auto rounded-2xl bg-bg p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl">{fill(l.seriesTitle, { n: series.get(seriesOpen)!.length })}</h3>
              <button type="button" className="text-sm underline" onClick={() => setSeriesOpen(null)}>
                {l.close}
              </button>
            </div>
            <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
              {series.get(seriesOpen)!.map((id) => (
                <figure key={id} className="flex w-60 shrink-0 flex-col gap-2">
                  <div className="relative aspect-[4/3] bg-line">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {thumbs.get(id) && <img src={thumbs.get(id)} alt={byId.get(id)?.name ?? ''} className="h-full w-full object-contain" />}
                  </div>
                  <figcaption className="flex items-center gap-2 text-xs">
                    <span className="truncate">{byId.get(id)?.name}</span>
                    <Marks verdict={verdicts[id]} outcome={outcomes.get(id)} mark={session.marks[id]} labels={l} />
                  </figcaption>
                  <div className="flex gap-1.5 text-[11px]">
                    {!verdicts[id]?.bestInSeries && (
                      <button type="button" className="rounded-full border border-line px-2 py-1 hover:border-fg" onClick={() => setSession((s) => s && { ...s, bestOverrides: { ...s.bestOverrides, [seriesOpen]: id } })}>
                        ★ {l.makeBest}
                      </button>
                    )}
                    <button type="button" className="rounded-full border border-line px-2 py-1 hover:border-fg" onClick={() => setMark(id, { flag: 'pick' })}>P</button>
                    <button type="button" className="rounded-full border border-line px-2 py-1 hover:border-fg" onClick={() => setMark(id, { flag: 'reject' })}>X</button>
                  </div>
                </figure>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function Marks({ verdict, outcome, mark, labels: l }: { verdict?: PhotoVerdict; outcome?: Outcome; mark?: Mark; labels: FolderLabels }) {
  const flags = verdict?.flags ?? []
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {mark?.flag === 'pick' && <span data-mark="pick" className="rounded bg-emerald-600 px-1.5 text-[10px] font-bold text-white">P</span>}
      {outcome?.reject && <span data-mark="reject" className={`rounded px-1.5 text-[10px] font-bold text-white ${mark?.flag === 'reject' ? 'bg-red-600' : 'bg-red-600/70'}`}>X</span>}
      {outcome?.best && <span data-mark="best" className="rounded bg-neutral-900 px-1.5 text-[10px] font-bold text-white">★ {l.badgeBest}</span>}
      {flags.includes('blurry') && <span data-flag="blurry" className="rounded bg-accent px-1.5 text-[10px] font-bold text-white">{l.badgeBlurry}</span>}
      {flags.includes('eyes') && <span data-flag="eyes" className="rounded bg-accent px-1.5 text-[10px] font-bold text-white">{l.badgeEyes}</span>}
      {flags.includes('duplicate') && <span data-flag="duplicate" className="rounded bg-neutral-500 px-1.5 text-[10px] font-bold text-white">{l.badgeDuplicate}</span>}
      {!!mark?.stars && <span data-mark="stars" className="text-[11px] text-amber-500">{'★'.repeat(mark.stars)}</span>}
    </span>
  )
}

function Tile(props: {
  item: FolderItem
  thumb?: string
  verdict?: PhotoVerdict
  outcome?: Outcome
  mark?: Mark
  error?: string
  seriesSize: number
  focused: boolean
  labels: FolderLabels
  onFocus: () => void
  onOpen: () => void
  onSeries: () => void
}) {
  const { item, thumb, verdict, outcome, mark, error, seriesSize, focused, labels: l } = props
  return (
    <figure
      className={`flex flex-col gap-1 rounded-lg p-1 ${focused ? 'bg-fg/10 ring-2 ring-fg' : ''}`}
      onClick={props.onFocus}
      onDoubleClick={props.onOpen}
      data-testid="cull-tile"
      data-id={item.id}
      data-focused={focused || undefined}
    >
      <div className={`relative overflow-hidden bg-line ${outcome?.reject ? 'opacity-60' : ''}`} style={{ height: TILE }}>
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt={item.name} className="h-full w-full object-contain" draggable={false} />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-[10px] uppercase text-muted">{error ?? item.name.split('.').pop()}</span>
        )}
        <span className="absolute left-1 top-1">
          <Marks verdict={verdict} outcome={outcome} mark={mark} labels={l} />
        </span>
        {seriesSize > 1 && (
          <button type="button" onClick={props.onSeries} className="absolute bottom-1 right-1 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-bold uppercase text-neutral-900 shadow">
            {fill(l.series, { n: seriesSize })}
          </button>
        )}
      </div>
      <figcaption className="truncate text-[11px] text-muted">{item.name}</figcaption>
    </figure>
  )
}
