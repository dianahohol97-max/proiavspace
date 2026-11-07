'use client'

import { useMemo, useState, useTransition } from 'react'
import { slotEndTime } from '@/lib/booking/slotTemplate'
import { addDays, slotKey, weekStart } from '@/lib/booking/time'
import type { SlotStatus } from '@/lib/booking/types'
import type { Dictionary } from '@/lib/i18n'

export interface DashboardSlot {
  id: string
  starts_at: string
  duration_minutes: number
  price_uah: number
  status: SlotStatus
  client_name: string | null
  client_phone: string | null
  client_email: string | null
}

type Filter = 'all' | 'free' | 'booked' | 'paid'
type Labels = Dictionary['booking']

const fill = (text: string, values: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ''))

/** Date label without any time-zone shift: the parts are wall-clock. */
function dateLabel(date: string, lang: string, opts: Intl.DateTimeFormatOptions): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Intl.DateTimeFormat(lang, { ...opts, timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)))
}

interface DayGroup {
  date: string
  slots: DashboardSlot[]
}
interface WeekGroup {
  week: string
  days: DayGroup[]
}

function group(slots: DashboardSlot[]): WeekGroup[] {
  const weeks: WeekGroup[] = []
  for (const slot of slots) {
    const date = slotKey(slot.starts_at).slice(0, 10)
    const week = weekStart(date)
    let w = weeks[weeks.length - 1]
    if (!w || w.week !== week) {
      w = { week, days: [] }
      weeks.push(w)
    }
    let d = w.days[w.days.length - 1]
    if (!d || d.date !== date) {
      d = { date, slots: [] }
      w.days.push(d)
    }
    d.slots.push(slot)
  }
  return weeks
}

/**
 * The photographer's slots grouped by week → day, with a status filter and
 * bulk actions: select free slots → delete; «Закрити день» removes every free
 * slot of a date. Booked and paid slots are never selectable or deletable.
 */
export function SlotList({
  slots,
  lang,
  labels,
  onDeleteMany,
  onCloseDay,
  onMarkPaid,
  onReopen,
}: {
  slots: DashboardSlot[]
  lang: string
  labels: Labels
  onDeleteMany: (ids: string[]) => Promise<unknown>
  onCloseDay: (date: string) => Promise<unknown>
  onMarkPaid: (id: string) => Promise<unknown>
  onReopen: (id: string) => Promise<unknown>
}) {
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pending, startTransition] = useTransition()

  const counts = useMemo(
    () => ({
      all: slots.length,
      free: slots.filter((s) => s.status === 'free').length,
      booked: slots.filter((s) => s.status === 'booked').length,
      paid: slots.filter((s) => s.status === 'paid').length,
    }),
    [slots]
  )
  const visible = useMemo(
    () => (filter === 'all' ? slots : slots.filter((s) => s.status === filter)),
    [slots, filter]
  )
  const weeks = useMemo(() => group(visible), [visible])
  // Drop selections that vanished (deleted, booked meanwhile).
  const liveSelected = useMemo(() => {
    const free = new Set(slots.filter((s) => s.status === 'free').map((s) => s.id))
    return [...selected].filter((id) => free.has(id))
  }, [selected, slots])

  const statusLabel: Record<SlotStatus, string> = {
    free: labels.statusFree,
    booked: labels.statusBooked,
    paid: labels.statusPaid,
    canceled: labels.statusCanceled,
  }

  function run(task: () => Promise<unknown>) {
    startTransition(async () => {
      await task()
    })
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleDay(day: DayGroup) {
    const free = day.slots.filter((s) => s.status === 'free').map((s) => s.id)
    setSelected((prev) => {
      const next = new Set(prev)
      const all = free.every((id) => next.has(id))
      for (const id of free) {
        if (all) next.delete(id)
        else next.add(id)
      }
      return next
    })
  }

  const filters: { id: Filter; label: string }[] = [
    { id: 'all', label: labels.filterAll },
    { id: 'free', label: labels.filterFree },
    { id: 'booked', label: labels.filterBooked },
    { id: 'paid', label: labels.filterPaid },
  ]

  return (
    <div className={pending ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
      <div role="tablist" className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={`shrink-0 border px-3 py-1.5 text-xs uppercase tracking-widest transition-colors ${
              filter === f.id ? 'border-fg bg-fg text-bg' : 'border-line text-muted hover:border-fg'
            }`}
          >
            {f.label} <span className="opacity-60">{counts[f.id]}</span>
          </button>
        ))}
      </div>

      {weeks.length === 0 ? (
        <p className="mt-8 max-w-xl leading-relaxed text-muted">
          {slots.length === 0 ? labels.noSlots : labels.noSlotsFilter}
        </p>
      ) : (
        <div className="mt-6 flex flex-col gap-8">
          {weeks.map((week) => {
            const last = addDays(week.week, 6)
            return (
              <section key={week.week} aria-label={week.week}>
                <h3 className="border-b border-fg pb-2 text-xs uppercase tracking-[0.2em] text-muted">
                  {fill(labels.weekOf, {
                    range: `${dateLabel(week.week, lang, { day: 'numeric', month: 'short' })} – ${dateLabel(
                      last,
                      lang,
                      { day: 'numeric', month: 'short' }
                    )}`,
                  })}
                </h3>
                {week.days.map((day) => {
                  const free = day.slots.filter((s) => s.status === 'free')
                  const allSelected = free.length > 0 && free.every((s) => selected.has(s.id))
                  return (
                    <div key={day.date} className="border-b border-line py-3" data-testid="slot-day">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        <span className="font-display text-lg first-letter:uppercase">
                          {dateLabel(day.date, lang, { weekday: 'short', day: 'numeric', month: 'long' })}
                        </span>
                        <span className="text-xs text-muted">
                          {fill(labels.dayCounts, { free: free.length, total: day.slots.length })}
                        </span>
                        {free.length > 0 && (
                          <span className="ml-auto flex gap-4 text-xs">
                            <button type="button" onClick={() => toggleDay(day)} className="underline hover:text-accent">
                              {allSelected ? labels.clearSelection : labels.selectDay}
                            </button>
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => {
                                const human = dateLabel(day.date, lang, { day: 'numeric', month: 'long' })
                                if (window.confirm(fill(labels.closeDayConfirm, { date: human }))) {
                                  run(() => onCloseDay(day.date))
                                }
                              }}
                              className="text-muted underline hover:text-accent"
                            >
                              {labels.closeDay}
                            </button>
                          </span>
                        )}
                      </div>
                      <ul className="mt-2 flex flex-col">
                        {day.slots.map((slot) => {
                          const time = slotKey(slot.starts_at).slice(11, 16)
                          const isFree = slot.status === 'free'
                          return (
                            <li
                              key={slot.id}
                              className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1 py-2"
                              data-testid="slot-row"
                            >
                              <span className="flex w-6 justify-center">
                                {isFree && (
                                  <input
                                    type="checkbox"
                                    className="h-5 w-5 accent-current"
                                    aria-label={`${day.date} ${time}`}
                                    checked={selected.has(slot.id)}
                                    onChange={() => toggle(slot.id)}
                                  />
                                )}
                              </span>
                              <span className="min-w-0">
                                <span className="font-display text-base tabular-nums">
                                  {time}–{slotEndTime(slot.starts_at, slot.duration_minutes)}
                                </span>
                                <span className="ml-2 text-xs text-muted">
                                  {Number(slot.price_uah) > 0 ? `${Number(slot.price_uah)} ${labels.currency}` : labels.priceFree}
                                </span>
                                {slot.client_name && (
                                  <span className="block truncate text-xs text-muted">
                                    {slot.client_name} · {slot.client_phone} · {slot.client_email}
                                  </span>
                                )}
                              </span>
                              <span
                                className={`justify-self-end px-2 py-0.5 text-[10px] uppercase tracking-widest ${
                                  slot.status === 'paid'
                                    ? 'bg-fg text-bg'
                                    : slot.status === 'booked'
                                      ? 'border border-fg'
                                      : 'border border-line text-muted'
                                }`}
                              >
                                {statusLabel[slot.status]}
                              </span>
                              {(slot.status === 'booked' || slot.status === 'paid') && (
                                <span className="col-start-2 col-end-4 flex flex-wrap gap-4 text-xs">
                                  {slot.status === 'booked' && (
                                    <button type="button" disabled={pending} onClick={() => run(() => onMarkPaid(slot.id))} className="underline hover:text-accent">
                                      {labels.markPaid}
                                    </button>
                                  )}
                                  <button type="button" disabled={pending} onClick={() => run(() => onReopen(slot.id))} className="text-muted underline hover:text-fg">
                                    {labels.reopen}
                                  </button>
                                </span>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )
                })}
              </section>
            )
          })}
        </div>
      )}

      {liveSelected.length > 0 && (
        <div className="sticky bottom-0 z-10 -mx-4 mt-4 flex items-center gap-4 border-t border-fg bg-bg px-4 py-3 sm:mx-0" data-testid="bulk-bar">
          <span className="text-sm">{fill(labels.selectedCount, { n: liveSelected.length })}</span>
          <button type="button" onClick={() => setSelected(new Set())} className="text-sm text-muted underline">
            {labels.clearSelection}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (window.confirm(fill(labels.deleteSelectedConfirm, { n: liveSelected.length }))) {
                const ids = liveSelected
                run(async () => {
                  await onDeleteMany(ids)
                  setSelected(new Set())
                })
              }
            }}
            className="ml-auto border border-fg px-4 py-2 text-xs uppercase tracking-widest hover:bg-fg hover:text-bg"
          >
            {labels.deleteSelected}
          </button>
        </div>
      )}
    </div>
  )
}
