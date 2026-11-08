'use client'

import { useRef, useState } from 'react'

export interface DownloadsToggleLabels {
  title: string
  label: string
  onHint: string
  offHint: string
  unavailable: string
  saving: string
  saved: string
  error: string
}

type Save = (enabled: boolean) => Promise<{ ok: boolean; error?: 'migration' | 'failed' }>

/**
 * «Клієнт може завантажувати фото» — a switch saved on every flip (like the
 * shoot status). On failure it flips back and says why; before migration
 * 0068 it is shown disabled with a plain explanation.
 */
export function DownloadsToggle({
  initialEnabled,
  available,
  save,
  labels,
  children,
}: {
  initialEnabled: boolean
  /** false — the column is not in the database yet (0068 not applied). */
  available: boolean
  save: Save
  labels: DownloadsToggleLabels
  /** The downloads counter, under the switch. */
  children?: React.ReactNode
}) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error' | 'migration'>(
    available ? 'idle' : 'migration'
  )
  const seq = useRef(0)

  async function flip() {
    if (state === 'migration') return
    const next = !enabled
    const id = ++seq.current
    setEnabled(next)
    setState('saving')
    let result: Awaited<ReturnType<Save>> = { ok: false, error: 'failed' }
    try {
      result = await save(next)
    } catch {
      /* network — reported below */
    }
    if (id !== seq.current) return
    if (result.ok) {
      setState('saved')
    } else {
      setEnabled(!next)
      setState(result.error === 'migration' ? 'migration' : 'error')
    }
  }

  const disabled = state === 'migration'
  return (
    <section className="rounded-2xl border border-line bg-white p-5 sm:p-6" data-testid="downloads-toggle">
      <h2 className="font-brand text-lg">{labels.title}</h2>
      <div className="mt-4 flex items-start gap-4">
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-labelledby="downloads-label"
          disabled={disabled}
          onClick={() => void flip()}
          className={`relative mt-0.5 inline-flex h-8 w-14 flex-none items-center rounded-full transition-colors disabled:opacity-50 ${
            enabled ? 'bg-emerald-600' : 'bg-neutral-300'
          }`}
        >
          <span
            aria-hidden
            className={`inline-block h-6 w-6 rounded-full bg-white shadow transition-transform ${
              enabled ? 'translate-x-7' : 'translate-x-1'
            }`}
          />
        </button>
        <div className="min-w-0">
          <p id="downloads-label" className="text-sm font-bold text-fg">
            {labels.label}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted">{enabled ? labels.onHint : labels.offHint}</p>
        </div>
      </div>
      <p
        className={`mt-3 min-h-[1.25rem] text-sm font-semibold ${
          state === 'error' ? 'text-red-700' : state === 'migration' ? 'text-amber-800' : 'text-emerald-700'
        }`}
        role={state === 'error' ? 'alert' : 'status'}
      >
        {state === 'saving'
          ? labels.saving
          : state === 'saved'
            ? labels.saved
            : state === 'error'
              ? labels.error
              : state === 'migration'
                ? labels.unavailable
                : ''}
      </p>
      {children}
    </section>
  )
}
