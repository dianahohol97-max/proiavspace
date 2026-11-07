'use client'

/**
 * «Відібрати кадри» — AI culling helper in the photographer's gallery page.
 *
 * Everything runs in the photographer's browser on the ~512 px renditions
 * (never originals): sharpness + dHash in Web Workers, closed eyes with the
 * MediaPipe face model, loaded only after the button is pressed. Flags are
 * suggestions; the photographer keeps or clears each one. Nothing is hidden
 * from clients automatically: «Сховати від клієнта» is an explicit click on
 * confirmed rejects (assets.hidden_from_client), «Повернути клієнту» undoes it.
 * Decisions live in IndexedDB and, once migration 0059 exists, in the account.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cullingLabels, fill, formatEta } from '@/lib/culling/i18n'
import { emptyState, loadState, saveState } from '@/lib/culling/store'
import { loadRemote, rowsFromState, saveRemote, stateFromRows, type DecisionRow } from '@/lib/culling/remote'
import type { Progress } from '@/lib/culling/runner'
import type { CullingPhoto, CullingState, Decision, FlagKind, PhotoAnalysis, PhotoVerdict } from '@/lib/culling/types'
import { computeVerdicts, seriesMembers } from '@/lib/culling/verdict'

type Filter = 'all' | 'flagged' | 'best' | 'hidden'
const PAGE = 120

export interface CullingPanelProps {
  galleryId: string
  locale: string
  photos: CullingPhoto[]
  /** Server action: hide (true) / show again (false) photos to the client. */
  onSetHidden?: (assetIds: string[], hidden: boolean) => Promise<void>
  /** The signed-in owner: enables saving decisions to the account (0059). */
  ownerId?: string
}

type SavedWhere = 'account' | 'device' | 'none'

function supported(): boolean {
  return typeof window !== 'undefined' && typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined'
}

export function CullingPanel({ galleryId, locale, photos, onSetHidden, ownerId }: CullingPanelProps) {
  const l = cullingLabels(locale)
  const [state, setState] = useState<CullingState>(() => emptyState(galleryId))
  const [loaded, setLoaded] = useState(false)
  const [where, setWhere] = useState<SavedWhere>('device')
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(photos.filter((p) => p.hidden).map((p) => p.id)))
  const [busy, setBusy] = useState(false)
  const remoteOk = useRef(false)
  const remoteRows = useRef<Map<string, DecisionRow>>(new Map())
  const photoIds = useMemo(() => new Set(photos.map((p) => p.id)), [photos])
  const [eyes, setEyes] = useState(true)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [running, setRunning] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('flagged')
  const [limit, setLimit] = useState(PAGE)
  const [openSeries, setOpenSeries] = useState<string | null>(null)
  const [canRun, setCanRun] = useState(true)
  const abortRef = useRef<AbortController | null>(null)
  const bufferRef = useRef<Record<string, PhotoAnalysis>>({})

  // The server is the truth for hidden_from_client (after revalidation).
  useEffect(() => {
    setHidden(new Set(photos.filter((p) => p.hidden).map((p) => p.id)))
  }, [photos])

  useEffect(() => {
    setCanRun(supported())
    let alive = true
    ;(async () => {
      let s = await loadState(galleryId)
      // Account copy (0059). Without the table this is null → device only.
      const rows = ownerId ? await loadRemote(galleryId) : null
      if (rows) {
        remoteOk.current = true
        remoteRows.current = rows
        // Once synced, the account wins (even empty: decisions undone on
        // another device stay undone). First time: this device's decisions
        // are uploaded by the save effect below.
        if (rows.size > 0 || s.remoteSynced) s = { ...s, ...stateFromRows(rows) }
        s = { ...s, remoteSynced: true, updatedAt: Date.now() }
      }
      if (!alive) return
      setWhere(rows ? 'account' : 'device')
      setState(s)
      setLoaded(true)
    })()
    return () => {
      alive = false
      abortRef.current?.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [galleryId])

  // Debounced local save of every change (analysis, decisions, best picks).
  useEffect(() => {
    if (!loaded || state.updatedAt === 0) return
    const timer = setTimeout(async () => {
      const onDevice = await saveState(state)
      if (remoteOk.current && ownerId) {
        const next = rowsFromState(state, photoIds)
        if (await saveRemote(galleryId, ownerId, remoteRows.current, next)) {
          remoteRows.current = next
          setWhere('account')
          return
        }
        // Account save failed: keep going on this device, quietly.
        remoteOk.current = false
      }
      setWhere(onDevice ? 'device' : 'none')
    }, 800)
    return () => clearTimeout(timer)
  }, [state, loaded, galleryId, ownerId, photoIds])

  const touch = useCallback((update: (s: CullingState) => CullingState) => {
    setState((s) => ({ ...update(s), updatedAt: Date.now() }))
  }, [])

  const flush = useCallback(() => {
    const batch = bufferRef.current
    if (Object.keys(batch).length === 0) return
    bufferRef.current = {}
    touch((s) => ({ ...s, analysis: { ...s.analysis, ...batch } }))
  }, [touch])

  const start = useCallback(
    async (fresh: boolean) => {
      if (running || photos.length === 0) return
      const controller = new AbortController()
      abortRef.current = controller
      setRunning(true)
      setNotice(null)
      const existing = fresh ? {} : state.analysis
      if (fresh) touch((s) => ({ ...s, analysis: {} }))
      // Batch results into React state a few times per second, not per photo.
      const ticker = setInterval(flush, 1000)
      try {
        const { runCulling } = await import('@/lib/culling/runner')
        await runCulling({
          photos,
          existing,
          eyes,
          signal: controller.signal,
          onResult: (id, analysis) => {
            bufferRef.current[id] = analysis
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
    },
    [running, photos, state.analysis, eyes, flush, touch, l.cancelled]
  )

  const cancel = () => abortRef.current?.abort()

  const verdicts = useMemo(
    () => computeVerdicts(photos, state.analysis, state.bestOverrides),
    [photos, state.analysis, state.bestOverrides]
  )
  const series = useMemo(() => seriesMembers(verdicts, photos), [verdicts, photos])
  const byId = useMemo(() => new Map(photos.map((p) => [p.id, p])), [photos])

  const analysed = photos.filter((p) => state.analysis[p.id]).length
  const failed = photos.filter((p) => state.analysis[p.id]?.error).length
  const missing = photos.length - analysed
  const hasResults = analysed > 0

  const isFlagged = (id: string) => (verdicts[id]?.flags.length ?? 0) > 0 && state.decisions[id] !== 'cleared'
  const counts = useMemo(() => {
    const c: Record<FlagKind, number> = { blurry: 0, duplicate: 0, eyes: 0 }
    for (const v of Object.values(verdicts)) for (const f of v.flags) c[f]++
    return c
  }, [verdicts])
  const flaggedIds = photos.filter((p) => isFlagged(p.id)).map((p) => p.id)
  const confirmedIds = photos.filter((p) => state.decisions[p.id] === 'confirmed' && verdicts[p.id]?.flags.length).map((p) => p.id)
  const toHide = confirmedIds.filter((id) => !hidden.has(id))
  const visible = photos.filter((p) =>
    filter === 'hidden'
      ? hidden.has(p.id)
      : filter === 'all'
        ? !!state.analysis[p.id]
        : filter === 'flagged'
          ? isFlagged(p.id)
          : verdicts[p.id]?.bestInSeries
  )

  const decide = (id: string, decision: Decision | null) =>
    touch((s) => {
      const decisions = { ...s.decisions }
      if (decision) decisions[id] = decision
      else delete decisions[id]
      return { ...s, decisions }
    })
  const makeBest = (seriesId: string, id: string) =>
    touch((s) => ({ ...s, bestOverrides: { ...s.bestOverrides, [seriesId]: id } }))

  /** Hide/show to the client — always an explicit click, re-checked on the server. */
  const setHiddenFor = async (ids: string[], value: boolean) => {
    if (!onSetHidden || ids.length === 0 || busy) return
    if (value && !window.confirm(fill(l.hideConfirm, { n: ids.length }, locale))) return
    setBusy(true)
    try {
      await onSetHidden(ids, value)
      setHidden((prev) => {
        const next = new Set(prev)
        for (const id of ids) {
          if (value) next.add(id)
          else next.delete(id)
        }
        return next
      })
      setNotice(fill(value ? l.hidden : l.unhidden, { n: ids.length }, locale))
    } catch {
      setNotice(l.hideFailed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mt-12 rounded-2xl border border-line p-5 sm:p-6" data-testid="culling-panel">
      <div className="flex flex-col gap-4">
        <div className="max-w-2xl">
          <h2 className="font-display text-2xl">{l.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">{l.intro}</p>
        </div>
        <div className="flex flex-col items-start gap-2">
          {running ? (
            <button
              type="button"
              onClick={cancel}
              className="border border-fg px-6 py-2 text-sm uppercase tracking-widest transition-colors hover:bg-fg hover:text-bg"
            >
              {l.cancel}
            </button>
          ) : (
            <div className="flex flex-wrap gap-2">
              {hasResults && missing > 0 && (
                <button
                  type="button"
                  onClick={() => start(false)}
                  disabled={!canRun}
                  className="border border-line px-4 py-2 text-sm transition-colors hover:border-fg disabled:opacity-50"
                >
                  {l.resume} ({missing})
                </button>
              )}
              <button
                type="button"
                onClick={() => start(hasResults && missing === 0)}
                disabled={!canRun || photos.length === 0 || !loaded}
                data-testid="culling-start"
                className="border border-fg bg-fg px-6 py-2 text-sm uppercase tracking-widest text-bg transition-colors hover:bg-transparent hover:text-fg disabled:opacity-50"
              >
                {hasResults && missing === 0 ? l.rerun : l.start}
              </button>
            </div>
          )}
          <label className="flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" checked={eyes} disabled={running} onChange={(e) => setEyes(e.target.checked)} />
            {l.eyesToggle}
          </label>
        </div>
      </div>

      {!canRun && <p className="mt-4 text-sm text-accent">{l.unsupported}</p>}
      {photos.length === 0 && <p className="mt-4 text-sm text-muted">{l.noPhotos}</p>}

      {progress && (running || progress.stage !== 'done') && (
        <div className="mt-5" role="status" aria-live="polite" data-testid="culling-progress">
          <div className="flex flex-wrap justify-between gap-2 text-xs text-muted">
            <span>
              {progress.stage === 'measure'
                ? eyes
                  ? l.stepMeasure
                  : l.stepMeasureOnly
                : progress.stage === 'model'
                  ? l.stepModel
                  : progress.stage === 'faces'
                    ? l.stepFaces
                    : l.done}{' '}
              · {progress.done}/{progress.total}
            </span>
            <span>
              {progress.paused
                ? l.paused
                : progress.etaMs !== null && progress.etaMs > 0
                  ? fill(l.eta, { t: formatEta(progress.etaMs, l) }, locale)
                  : ''}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
            <div
              className="h-full bg-fg transition-[width] duration-300"
              style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%` }}
            />
          </div>
        </div>
      )}
      {progress?.facesError && <p className="mt-3 text-xs text-accent">{l.facesFailed}</p>}
      {notice && <p className="mt-3 text-xs text-muted">{notice}</p>}

      {(hasResults || hidden.size > 0) && (
        <>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
            {hasResults ? (
              <p className="text-sm" data-testid="culling-summary">
                {fill(l.summary, { ...counts, series: series.size }, locale)}
                {failed > 0 && <span className="text-muted"> · {fill(l.failedCount, { n: failed }, locale)}</span>}
              </p>
            ) : (
              <span />
            )}
            <p
              className="text-xs text-muted"
              title={where === 'account' ? l.savedAccountHint : l.savedLocalHint}
              data-testid="culling-saved"
            >
              {where === 'none' ? l.notSaved : `✓ ${where === 'account' ? l.savedAccount : l.savedLocal}`}
            </p>
          </div>
          {running && <p className="mt-2 text-xs text-muted">{l.preliminary}</p>}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {(
              [
                ['flagged', l.filterFlagged, flaggedIds.length],
                ['best', l.filterBest, photos.filter((p) => verdicts[p.id]?.bestInSeries).length],
                ['all', l.filterAll, analysed - failed],
                ['hidden', l.filterHidden, hidden.size],
              ] as const
            )
              .filter(([key]) => key === 'hidden' || hasResults)
              .map(([key, label, n]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setFilter(key)
                  setLimit(PAGE)
                }}
                aria-pressed={filter === key}
                className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                  filter === key ? 'border-fg bg-fg text-bg' : 'border-line hover:border-fg'
                }`}
              >
                {label} · {n}
              </button>
            ))}
            {onSetHidden && (
              <span className="ml-auto" title={toHide.length ? l.hideHint : l.hideNothing}>
                <button
                  type="button"
                  disabled={toHide.length === 0 || busy}
                  onClick={() => setHiddenFor(toHide, true)}
                  className="rounded-full border border-fg px-3 py-1 text-sm transition-colors hover:bg-fg hover:text-bg disabled:cursor-not-allowed disabled:border-line disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-fg"
                  data-testid="culling-hide"
                >
                  {l.hide} ({toHide.length})
                </button>
              </span>
            )}
          </div>

          {visible.length === 0 ? (
            <p className="mt-6 text-sm text-muted">{l.emptyFilter}</p>
          ) : (
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" data-testid="culling-grid">
              {visible.slice(0, limit).map((p) => (
                <Tile
                  key={p.id}
                  photo={p}
                  verdict={verdicts[p.id]}
                  decision={state.decisions[p.id]}
                  seriesSize={verdicts[p.id]?.seriesId ? series.get(verdicts[p.id]!.seriesId!)?.length ?? 0 : 0}
                  labels={l}
                  hidden={hidden.has(p.id)}
                  busy={busy}
                  onDecide={(d) => decide(p.id, d)}
                  onSeries={() => setOpenSeries(verdicts[p.id]?.seriesId ?? null)}
                  onSetHidden={onSetHidden ? (value) => setHiddenFor([p.id], value) : undefined}
                />
              ))}
            </div>
          )}
          {visible.length > limit && (
            <button
              type="button"
              onClick={() => setLimit((n) => n + PAGE)}
              className="mt-5 border border-line px-5 py-2 text-sm hover:border-fg"
            >
              {l.showMore} ({visible.length - limit})
            </button>
          )}
        </>
      )}

      {openSeries && series.get(openSeries) && (
        <SeriesView
          ids={series.get(openSeries)!}
          byId={byId}
          verdicts={verdicts}
          decisions={state.decisions}
          labels={l}
          onClose={() => setOpenSeries(null)}
          onBest={(id) => makeBest(openSeries, id)}
          onDecide={decide}
        />
      )}
    </section>
  )
}

type Labels = ReturnType<typeof cullingLabels>

function Badges({ verdict, labels: l }: { verdict: PhotoVerdict | undefined; labels: Labels }) {
  if (!verdict) return null
  const names: Record<FlagKind, string> = { blurry: l.badgeBlurry, duplicate: l.badgeDuplicate, eyes: l.badgeEyes }
  return (
    <span className="pointer-events-none absolute left-1.5 top-1.5 flex flex-wrap gap-1">
      {verdict.bestInSeries && (
        <span className="rounded-full bg-fg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-bg">★ {l.badgeBest}</span>
      )}
      {verdict.flags.map((f) => (
        <span
          key={f}
          data-flag={f}
          className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
        >
          {names[f]}
        </span>
      ))}
    </span>
  )
}

function DecisionButtons({
  decision,
  labels: l,
  onDecide,
}: {
  decision: Decision | undefined
  labels: Labels
  onDecide: (d: Decision | null) => void
}) {
  if (decision) {
    return (
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className={decision === 'confirmed' ? 'text-accent' : 'text-muted'}>
          {decision === 'confirmed' ? l.badgeConfirmed : l.badgeCleared}
        </span>
        <button type="button" onClick={() => onDecide(null)} className="underline hover:text-accent">
          {l.undo}
        </button>
      </div>
    )
  }
  return (
    <div className="flex gap-1.5 text-[11px]">
      <button
        type="button"
        title={l.keepHint}
        onClick={() => onDecide('confirmed')}
        className="flex-1 rounded-full border border-line px-2 py-1 hover:border-fg"
      >
        {l.keep}
      </button>
      <button
        type="button"
        title={l.clearHint}
        onClick={() => onDecide('cleared')}
        className="flex-1 rounded-full border border-line px-2 py-1 hover:border-fg"
      >
        {l.clear}
      </button>
    </div>
  )
}

function Tile({
  photo,
  verdict,
  decision,
  seriesSize,
  labels: l,
  hidden,
  busy,
  onDecide,
  onSeries,
  onSetHidden,
}: {
  photo: CullingPhoto
  verdict: PhotoVerdict | undefined
  decision: Decision | undefined
  seriesSize: number
  labels: Labels
  hidden: boolean
  busy: boolean
  onDecide: (d: Decision | null) => void
  onSeries: () => void
  onSetHidden?: (hidden: boolean) => void
}) {
  const flagged = (verdict?.flags.length ?? 0) > 0
  return (
    <figure className="flex flex-col gap-1.5" style={{ contentVisibility: 'auto', containIntrinsicSize: '200px 260px' }} data-testid="culling-tile">
      <div className={`relative aspect-square overflow-hidden bg-line ${decision === 'cleared' ? 'opacity-70' : ''}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.url} alt={photo.name ?? ''} loading="lazy" decoding="async" className="h-full w-full object-cover" />
        <Badges verdict={decision === 'cleared' ? verdict && { ...verdict, flags: [] } : verdict} labels={l} />
        {hidden && (
          <span className="pointer-events-none absolute bottom-1.5 left-1.5 rounded-full bg-neutral-900/85 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            {l.badgeHidden}
          </span>
        )}
        {seriesSize > 1 && (
          <button
            type="button"
            onClick={onSeries}
            className="absolute bottom-1.5 right-1.5 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-900 shadow hover:text-accent"
          >
            {fill(l.series, { n: seriesSize }, locale)}
          </button>
        )}
      </div>
      {flagged && !hidden && <DecisionButtons decision={decision} labels={l} onDecide={onDecide} />}
      {onSetHidden && hidden && (
        <button
          type="button"
          disabled={busy}
          onClick={() => onSetHidden(false)}
          className="rounded-full border border-fg px-2 py-1 text-[11px] hover:bg-fg hover:text-bg disabled:opacity-50"
        >
          {l.unhide}
        </button>
      )}
      {onSetHidden && !hidden && decision === 'confirmed' && flagged && (
        <button
          type="button"
          disabled={busy}
          onClick={() => onSetHidden(true)}
          className="rounded-full border border-line px-2 py-1 text-[11px] hover:border-fg disabled:opacity-50"
        >
          {l.hideOne}
        </button>
      )}
    </figure>
  )
}

function SeriesView({
  ids,
  byId,
  verdicts,
  decisions,
  labels: l,
  onClose,
  onBest,
  onDecide,
}: {
  ids: string[]
  byId: Map<string, CullingPhoto>
  verdicts: Record<string, PhotoVerdict>
  decisions: Record<string, Decision>
  labels: Labels
  onClose: () => void
  onBest: (id: string) => void
  onDecide: (id: string, d: Decision | null) => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const maxRel = Math.max(...ids.map((id) => verdicts[id]?.relativeSharpness ?? 0), 0.0001)
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={fill(l.seriesTitle, { n: ids.length }, locale)}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      data-testid="culling-series"
    >
      <div className="max-h-full w-full max-w-6xl overflow-auto rounded-2xl bg-bg p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-4">
          <h3 className="font-display text-xl">{fill(l.seriesTitle, { n: ids.length }, locale)}</h3>
          <button type="button" onClick={onClose} className="text-sm underline">
            {l.close}
          </button>
        </div>
        <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
          {ids.map((id) => {
            const photo = byId.get(id)
            const verdict = verdicts[id]
            if (!photo || !verdict) return null
            const rel = verdict.relativeSharpness ?? 0
            return (
              <figure key={id} className="flex w-56 shrink-0 flex-col gap-2 sm:w-64">
                <div className="relative aspect-[4/5] overflow-hidden bg-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.url} alt={photo.name ?? ''} className="h-full w-full object-contain" />
                  <Badges verdict={verdict} labels={l} />
                </div>
                {photo.name && <figcaption className="truncate text-xs text-muted">{photo.name}</figcaption>}
                <div title={l.sharpnessLabel}>
                  <div className="h-1 overflow-hidden rounded-full bg-line">
                    <div className="h-full bg-fg" style={{ width: `${Math.round((rel / maxRel) * 100)}%` }} />
                  </div>
                </div>
                {!verdict.bestInSeries && (
                  <button
                    type="button"
                    onClick={() => onBest(id)}
                    className="rounded-full border border-line px-2 py-1 text-[11px] hover:border-fg"
                  >
                    ★ {l.makeBest}
                  </button>
                )}
                {verdict.flags.length > 0 && (
                  <DecisionButtons decision={decisions[id]} labels={l} onDecide={(d) => onDecide(id, d)} />
                )}
              </figure>
            )
          })}
        </div>
      </div>
    </div>
  )
}
