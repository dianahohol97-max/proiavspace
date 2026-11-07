'use client'

/**
 * «Магічна збірка» — the whole album in one click: source (gallery or the
 * frames picked in the strip), number of spreads, print profile, style. The
 * frames are measured in Web Workers on previews (the AI culling pass and its
 * cache), then three styles are laid out at once; the editor shows one and
 * flips through them with ← →.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { AlbumBackend } from '@/lib/album/backend'
import { EXAMPLE_PROFILES, describeSpec } from '@/lib/album/profiles'
import { analyzeForMagic, type MagicProgress } from '@/lib/album/magic/analyze'
import { buildMagicVariants, capacity, MAGIC_STYLES, type MagicResult, type MagicStyle } from '@/lib/album/magic'
import type { AlbumPhoto, PrintProfile, PrintSpec } from '@/lib/album/types'
import { btn, btnPrimary, input, label } from './ui'

export interface MagicOutcome {
  results: MagicResult[]
  index: number
  /** Wall time of the whole build and its parts, ms. */
  ms: number
  measured: number
  faced: number
  spec: PrintSpec
}

const STAGE_TEXT: Record<MagicProgress['stage'], string> = {
  measure: 'Оцінюю кадри: різкість, повтори, кольори',
  model: 'Завантажую модель облич',
  faces: 'Шукаю обличчя й заплющені очі',
  compose: 'Складаю історію й розвороти',
  done: 'Готово',
}

export function suggestedSpreads(visible: number): number {
  return Math.min(30, Math.max(5, Math.round(visible / 8)))
}

export function MagicDialog({
  backend,
  projectId,
  photos,
  picked,
  spec,
  canChangeProfile,
  galleryKey,
  defaultTitle,
  initial,
  onDone,
  onClose,
}: {
  backend: AlbumBackend
  projectId: string
  photos: AlbumPhoto[]
  picked: string[]
  spec: PrintSpec
  /** Only while nothing is placed: a laid-out album is never re-flowed by a profile change. */
  canChangeProfile: boolean
  galleryKey: string
  defaultTitle: string
  initial?: { spreads?: number; style?: MagicStyle; autoStart?: boolean }
  onDone(outcome: MagicOutcome): void
  onClose(): void
}) {
  const [source, setSource] = useState<'gallery' | 'picked'>(picked.length >= 2 ? 'picked' : 'gallery')
  const pool = useMemo(() => {
    if (source === 'gallery') return photos
    const set = new Set(picked)
    return photos.filter((p) => set.has(p.id))
  }, [source, photos, picked])
  const visible = pool.filter((p) => !p.hidden).length
  const [spreads, setSpreads] = useState(initial?.spreads ?? suggestedSpreads(visible))
  const [style, setStyle] = useState<MagicStyle>(initial?.style ?? 'editorial')
  const [title, setTitle] = useState(defaultTitle)
  const [eyes, setEyes] = useState(true)
  const [profiles, setProfiles] = useState<PrintProfile[]>([])
  const [profileId, setProfileId] = useState('')
  const [progress, setProgress] = useState<MagicProgress | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const abort = useRef<AbortController | null>(null)
  const busy = progress !== null

  useEffect(() => {
    if (!canChangeProfile) return
    backend.listProfiles().then(setProfiles, () => undefined)
  }, [backend, canChangeProfile])
  const allProfiles = [...profiles, ...EXAMPLE_PROFILES]
  const chosenSpec = allProfiles.find((p) => p.id === profileId)?.spec ?? spec

  const hearts = pool.filter((p) => !p.hidden && ((p.favorites ?? 0) > 0 || p.retouch)).length
  const hidden = pool.length - visible
  const dated = pool.filter((p) => p.takenAt != null).length
  const need = capacity(style, spreads).photos

  const start = async () => {
    if (!visible) return
    const controller = new AbortController()
    abort.current = controller
    setError(null)
    const t0 = performance.now()
    const tick = setInterval(() => setElapsed(performance.now() - t0), 250)
    setProgress({ stage: 'measure', done: 0, total: visible, etaMs: null })
    try {
      const target = Math.max(1, Math.min(spreads, visible))
      let useSpec = spec
      if (canChangeProfile && profileId && chosenSpec !== spec) useSpec = await backend.setSpec(projectId, chosenSpec)
      const plan = { spec: useSpec, targetSpreads: target, title: title.trim() || defaultTitle }
      const analysis = await analyzeForMagic({
        galleryKey,
        remote: backend.kind === 'server',
        pool,
        plan,
        eyes,
        signal: controller.signal,
        onProgress: setProgress,
      })
      setProgress({ stage: 'compose', done: 0, total: 1, etaMs: null })
      await new Promise((r) => setTimeout(r, 0))
      const results = buildMagicVariants({
        ...plan,
        photos: pool,
        analysis: analysis.analysis,
        decisions: analysis.decisions,
        bestOverrides: analysis.bestOverrides,
      })
      onDone({
        results,
        index: MAGIC_STYLES.findIndex((s) => s.id === style),
        ms: performance.now() - t0,
        measured: analysis.timings.measured,
        faced: analysis.timings.faced,
        spec: useSpec,
      })
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) setError(e instanceof Error ? e.message : 'Не вдалося зібрати альбом')
      setProgress(null)
    } finally {
      clearInterval(tick)
      abort.current = null
    }
  }

  // Opened from «Новий альбом» with «Магічна збірка»: start right away.
  const autoStarted = useRef(false)
  useEffect(() => {
    if (initial?.autoStart && !autoStarted.current && photos.length) {
      autoStarted.current = true
      void start()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.autoStart, photos.length])

  const fraction = progress && progress.total > 0 ? progress.done / progress.total : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Магічна збірка" data-testid="magic-dialog">
      <div className="max-h-full w-full max-w-lg overflow-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <h2 className="font-display text-2xl">✨ Магічна збірка</h2>
          <button className="text-2xl leading-none text-muted hover:text-fg" onClick={() => (abort.current ? abort.current.abort() : onClose())} aria-label="Закрити">
            ×
          </button>
        </div>
        <p className="mt-1 text-sm text-muted">
          Увесь альбом одним кліком: кращі кадри за AI-відбором, історія за часом зйомки, ритм і пари, обкладинка. Три стилі — перемикайте стрілками ← →, усе
          скасовується одним кроком.
        </p>

        <fieldset className="mt-4 flex flex-col gap-3" disabled={busy}>
          <div className="flex flex-col gap-1.5">
            <span className={label}>Кадри</span>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="magic-source" checked={source === 'gallery'} onChange={() => setSource('gallery')} />
              Уся галерея ({photos.length})
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="magic-source" checked={source === 'picked'} onChange={() => setSource('picked')} disabled={picked.length < 2} />
              Позначені в плівці ({picked.length})
            </label>
            <p className="text-xs text-muted" data-testid="magic-pool">
              {hidden > 0 && `${hidden} сховано від клієнта — не беруться. `}
              {hearts > 0 && `${hearts} із сердечком або на ретуш — у пріоритеті. `}
              {dated < pool.length && `${pool.length - dated} без дати зйомки — за назвою файлу.`}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1" htmlFor="magic-spreads">
              <span className={label}>Розворотів</span>
              <input
                id="magic-spreads"
                type="number"
                min={1}
                max={80}
                className={input}
                value={spreads}
                onChange={(e) => setSpreads(Math.max(1, Math.min(80, Number(e.target.value) || 1)))}
              />
              <span className="text-xs text-muted">≈ {need} кадрів + обкладинка</span>
            </label>
            <label className="flex flex-col gap-1" htmlFor="magic-title">
              <span className={label}>Назва на обкладинці</span>
              <input id="magic-title" className={input} value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
          </div>
          <label className="flex flex-col gap-1" htmlFor="magic-profile">
            <span className={label}>Профіль друку</span>
            {canChangeProfile ? (
              <select id="magic-profile" className={input} value={profileId} onChange={(e) => setProfileId(e.target.value)}>
                <option value="">Поточний: {describeSpec(spec)}</option>
                {allProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-sm">{describeSpec(spec)}</span>
            )}
          </label>
          <div className="flex flex-col gap-1.5">
            <span className={label}>Стиль, з якого почати</span>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Стиль">
              {MAGIC_STYLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={style === s.id}
                  onClick={() => setStyle(s.id)}
                  className={`rounded-xl border p-2 text-left ${style === s.id ? 'border-fg bg-accent-soft' : 'border-line hover:border-fg'}`}
                >
                  <span className="block text-sm font-bold">{s.name}</span>
                  <span className="block text-[11px] leading-snug text-muted">{s.hint}</span>
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={eyes} onChange={(e) => setEyes(e.target.checked)} />
            Обличчя й заплющені очі (модель вантажиться один раз, ~17 МБ)
          </label>
        </fieldset>

        {progress && (
          <div className="mt-4" data-testid="magic-progress" data-stage={progress.stage}>
            <div className="h-2 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${Math.round(fraction * 100)}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-muted">
              {STAGE_TEXT[progress.stage]}
              {progress.total > 1 && ` · ${progress.done} з ${progress.total}`} · {Math.round(elapsed / 1000)} с
              {progress.etaMs !== null && progress.etaMs > 1500 && ` · ще ~${Math.ceil(progress.etaMs / 1000)} с`}
            </p>
            {progress.facesError && <p className="mt-1 text-xs text-amber-800">Модель облич не завантажилась — фокус з головного об'єкта.</p>}
          </div>
        )}
        {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          {busy ? (
            <button className={btn} onClick={() => abort.current?.abort()} data-testid="magic-cancel">
              Скасувати
            </button>
          ) : (
            <>
              <button className={btn} onClick={onClose}>
                Закрити
              </button>
              <button className={btnPrimary} onClick={() => void start()} disabled={!visible} data-testid="magic-start">
                Зібрати альбом
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
