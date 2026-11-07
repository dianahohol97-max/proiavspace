'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  MAX_SLOTS_PER_BATCH,
  generateSlots,
  type SlotTemplate,
  type TemplateError,
  type TemplateMode,
} from '@/lib/booking/slotTemplate'
import { addDays } from '@/lib/booking/time'
import type { Dictionary } from '@/lib/i18n'

/** Result shape of the createSlotsFromTemplate server action. */
export interface TemplateCreateResult {
  ok: boolean
  created: number
  duplicates: number
  past: number
  nonexistent: number
  errors: (TemplateError | 'needs_migration' | 'db_error')[]
}

type Labels = Dictionary['booking']

const fill = (text: string, values: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ''))

const inputClass =
  'w-full min-w-0 border border-line bg-transparent px-3 py-2 text-base outline-none focus:border-fg sm:text-sm'

/**
 * «Створити слоти за шаблоном». The preview runs the same generator the
 * server uses, against the slots already on the page, so "N slots will be
 * created" is exactly what the insert does (duplicates and past times are
 * counted, not created).
 */
export function SlotTemplateForm({
  today,
  existingStarts,
  labels,
  onCreate,
}: {
  /** 'YYYY-MM-DD' in the photographer's zone. */
  today: string
  existingStarts: string[]
  labels: Labels
  onCreate: (template: SlotTemplate) => Promise<TemplateCreateResult>
}) {
  const [mode, setMode] = useState<TemplateMode>('times')
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(addDays(today, 27))
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5])
  const [times, setTimes] = useState<string[]>(['10:00', '13:00', '16:00'])
  const [rangeStart, setRangeStart] = useState('10:00')
  const [rangeEnd, setRangeEnd] = useState('18:00')
  const [step, setStep] = useState(60)
  const [duration, setDuration] = useState(60)
  const [allDayStart, setAllDayStart] = useState('10:00')
  const [allDayEnd, setAllDayEnd] = useState('22:00')
  const [price, setPrice] = useState(0)
  const [result, setResult] = useState<TemplateCreateResult | null>(null)
  const [pending, startTransition] = useTransition()

  const weekdayNames = labels.weekdaysShort.split(',')

  const template: SlotTemplate = useMemo(
    () => ({
      from,
      to,
      weekdays,
      mode,
      times,
      rangeStart: mode === 'allDay' ? allDayStart : rangeStart,
      rangeEnd: mode === 'allDay' ? allDayEnd : rangeEnd,
      stepMinutes: step,
      durationMinutes: duration,
      priceUah: price,
    }),
    [from, to, weekdays, mode, times, rangeStart, rangeEnd, allDayStart, allDayEnd, step, duration, price]
  )

  const preview = useMemo(
    () => generateSlots(template, { existing: existingStarts }),
    [template, existingStarts]
  )

  const errorText: Record<TemplateError | 'needs_migration' | 'db_error', string> = {
    bad_period: labels.errPeriod,
    period_too_long: labels.errPeriod,
    no_weekdays: labels.errWeekdays,
    no_times: labels.errTimes,
    bad_time: labels.errTimes,
    bad_range: labels.errRange,
    bad_step: labels.errStep,
    bad_duration: labels.errDuration,
    bad_price: labels.errPrice,
    too_many: fill(labels.errTooMany, { max: MAX_SLOTS_PER_BATCH }),
    needs_migration: labels.errMigration,
    db_error: labels.errDb,
  }

  const count = preview.slots.length
  const canCreate = preview.errors.length === 0 && count > 0 && !pending

  function toggleDay(day: number) {
    setResult(null)
    setWeekdays((d) => (d.includes(day) ? d.filter((x) => x !== day) : [...d, day].sort()))
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!canCreate) return
    startTransition(async () => {
      try {
        setResult(await onCreate(template))
      } catch {
        setResult({ ok: false, created: 0, duplicates: 0, past: 0, nonexistent: 0, errors: ['db_error'] })
      }
    })
  }

  const modes: { id: TemplateMode; label: string }[] = [
    { id: 'times', label: labels.modeTimes },
    { id: 'interval', label: labels.modeInterval },
    { id: 'allDay', label: labels.modeAllDay },
  ]

  const visibleErrors = [...new Set(preview.errors.map((e) => errorText[e]))]

  return (
    <form onSubmit={submit} onChange={() => setResult(null)} className="flex flex-col gap-5" data-testid="slot-template">
      <div role="tablist" aria-label={labels.templateTitle} className="grid grid-cols-3 border border-line">
        {modes.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={mode === m.id}
            onClick={() => {
              setMode(m.id)
              setResult(null)
            }}
            className={`px-2 py-2.5 text-xs uppercase tracking-widest transition-colors ${
              mode === m.id ? 'bg-fg text-bg' : 'text-muted hover:text-fg'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      {mode === 'allDay' && <p className="-mt-2 text-xs leading-relaxed text-muted">{labels.allDayHint}</p>}

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted">
          {labels.periodFrom}
          <input type="date" required value={from} min={today} onChange={(e) => setFrom(e.target.value)} className={inputClass} name="from" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          {labels.periodTo}
          <input type="date" required value={to} min={from} onChange={(e) => setTo(e.target.value)} className={inputClass} name="to" />
        </label>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-xs text-muted">{labels.weekdaysLabel}</legend>
        <div className="grid grid-cols-7 gap-1.5">
          {[1, 2, 3, 4, 5, 6, 7].map((day) => {
            const on = weekdays.includes(day)
            return (
              <label
                key={day}
                className={`flex h-11 cursor-pointer select-none items-center justify-center border text-sm transition-colors ${
                  on ? 'border-fg bg-fg text-bg' : 'border-line text-muted hover:border-fg'
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  name="weekday"
                  value={day}
                  checked={on}
                  onChange={() => toggleDay(day)}
                />
                {weekdayNames[day - 1] ?? day}
              </label>
            )
          })}
        </div>
      </fieldset>

      {mode === 'times' && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-xs text-muted">{labels.timesLabel}</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {times.map((time, i) => (
              <div key={i} className="flex items-stretch">
                <input
                  type="time"
                  step={300}
                  value={time}
                  aria-label={`${labels.timesLabel} ${i + 1}`}
                  onChange={(e) => setTimes((t) => t.map((x, j) => (j === i ? e.target.value : x)))}
                  className={inputClass}
                />
                {times.length > 1 && (
                  <button
                    type="button"
                    aria-label={labels.removeTime}
                    onClick={() => setTimes((t) => t.filter((_, j) => j !== i))}
                    className="border border-l-0 border-line px-3 text-muted hover:text-accent"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {times.length < 24 && (
              <button
                type="button"
                onClick={() => setTimes((t) => [...t, t.length ? nextTime(t[t.length - 1], duration) : '10:00'])}
                className="border border-dashed border-line px-3 py-2 text-sm text-muted hover:border-fg hover:text-fg"
              >
                {labels.addTime}
              </button>
            )}
          </div>
        </fieldset>
      )}

      {mode === 'interval' && (
        <div className="grid grid-cols-3 gap-3">
          <label className="flex flex-col gap-1 text-xs text-muted">
            {labels.rangeFrom}
            <input type="time" step={300} value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            {labels.rangeTo}
            <input type="time" step={300} value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            {labels.stepLabel}
            <input type="number" inputMode="numeric" min={5} step={5} value={step} onChange={(e) => setStep(Number(e.target.value))} className={inputClass} />
          </label>
        </div>
      )}

      {mode === 'allDay' && (
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs text-muted">
            {labels.rangeFrom}
            <input type="time" step={300} value={allDayStart} onChange={(e) => setAllDayStart(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            {labels.rangeTo}
            <input type="time" step={300} value={allDayEnd} onChange={(e) => setAllDayEnd(e.target.value)} className={inputClass} />
          </label>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {mode !== 'allDay' && (
          <label className="flex flex-col gap-1 text-xs text-muted">
            {labels.durationLabel}
            <input type="number" inputMode="numeric" min={15} step={15} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className={inputClass} name="duration" />
          </label>
        )}
        <label className="flex flex-col gap-1 text-xs text-muted">
          {labels.priceLabel}
          <input type="number" inputMode="numeric" min={0} step={50} value={price} onChange={(e) => setPrice(Number(e.target.value))} className={inputClass} name="price" />
        </label>
      </div>

      <div aria-live="polite" className="border-t border-line pt-4" data-testid="template-preview">
        {visibleErrors.length > 0 ? (
          <ul className="flex flex-col gap-1 text-sm text-accent">
            {visibleErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ) : (
          <p className="font-display text-xl">{fill(labels.previewCount, { n: count })}</p>
        )}
        {(preview.duplicates > 0 || preview.past > 0 || preview.nonexistent > 0) && (
          <p className="mt-1 text-xs leading-relaxed text-muted">
            {[
              preview.duplicates > 0 ? fill(labels.previewDuplicates, { n: preview.duplicates }) : null,
              preview.past > 0 ? fill(labels.previewPast, { n: preview.past }) : null,
              preview.nonexistent > 0 ? fill(labels.previewNonexistent, { n: preview.nonexistent }) : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
      </div>

      {result && (
        <p
          role="status"
          className={`border px-4 py-2 text-sm ${result.ok ? 'border-fg' : 'border-accent text-accent'}`}
        >
          {result.ok
            ? fill(labels.createdOk, { n: result.created })
            : [...new Set(result.errors.map((e) => errorText[e]))].join(' ')}
        </p>
      )}

      <button
        type="submit"
        disabled={!canCreate}
        className="w-full border border-fg px-6 py-3 text-sm uppercase tracking-widest transition-colors hover:bg-fg hover:text-bg disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:self-start"
      >
        {pending ? labels.creating : fill(labels.createSlots, { n: count })}
      </button>
    </form>
  )
}

/** Suggests the next start after `time` by one slot length. */
function nextTime(time: string, duration: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = Math.min((h || 0) * 60 + (m || 0) + (Number.isFinite(duration) && duration > 0 ? duration : 60), 23 * 60 + 55)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}
