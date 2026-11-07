'use client'

import { useState } from 'react'
import type { Outcome } from '@/lib/folder-cull/decide'
import { csvReport, planExport, type PlannedSidecar } from '@/lib/folder-cull/export'
import { fill, type FolderLabels } from '@/lib/folder-cull/i18n'
import type { Scan } from '@/lib/folder-cull/source'
import type { ExportSettings, FolderSession } from '@/lib/folder-cull/types'
import { buildZip, download, readExisting, writeToFolder } from '@/lib/folder-cull/write'

const LABELS = ['', 'Red', 'Yellow', 'Green', 'Blue', 'Purple'] as const

export function ExportPanel({
  session,
  scan,
  outcomes,
  order,
  flagsOf,
  labels: l,
  onSettings,
  onRecord,
}: {
  session: FolderSession
  scan: Scan | null
  outcomes: Map<string, Outcome>
  order: { id: string }[]
  flagsOf: (id: string) => string[]
  labels: FolderLabels
  onSettings: (s: ExportSettings) => void
  onRecord: (written: PlannedSidecar[]) => void
}) {
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const s = session.settings
  const set = (patch: Partial<ExportSettings>) => onSettings({ ...s, ...patch })
  const labelName = (v: string) =>
    v === '' ? l.labelNone : ({ Red: l.labelRed, Yellow: l.labelYellow, Green: l.labelGreen, Blue: l.labelBlue, Purple: l.labelPurple } as Record<string, string>)[v]
  const hasRaw = session.items.some((it) => it.kind === 'raw')
  const hasJpeg = session.items.some((it) => it.kind !== 'raw')

  const plan = async () => {
    const existing = scan ? await readExisting(scan) : { text: new Map(), names: new Map() }
    return planExport(session, outcomes, existing.text, existing.names)
  }
  const ms = (n: number) => (n < 1000 ? `${Math.round(n)} ms` : `${(n / 1000).toFixed(1)} s`)

  const writeFolder = async () => {
    if (!scan?.handle) return
    setBusy(true)
    setStatus(l.writing)
    try {
      const p = await plan()
      const r = await writeToFolder(scan.handle, p.sidecars)
      if (!r) return setStatus(l.writeDenied)
      onRecord(r.written)
      const created = r.written.filter((x) => !x.existed).length
      setStatus(
        fill(l.writeDone, {
          created,
          updated: r.written.length - created,
          failed: r.failed.length ? fill(l.writeFailed, { n: r.failed.length }) : '',
          ms: ms(r.ms),
        }) + (p.unreadable.length ? ` · ${fill(l.unreadable, { n: p.unreadable.length })}` : '')
      )
    } finally {
      setBusy(false)
    }
  }

  const csv = () => csvReport(session, order, outcomes, flagsOf)

  const zip = async () => {
    setBusy(true)
    try {
      const p = await plan()
      const readme = [l.howTo, '', l.howToC1, '', l.jpegNote].join('\r\n')
      const blob = await buildZip(session.folderName, p.sidecars, [
        { name: 'README.txt', text: readme },
        { name: 'culling.csv', text: csv() },
      ])
      download(blob, `${session.folderName}-xmp.zip`)
      onRecord(p.sidecars)
      setStatus(fill(l.zipDone, { n: p.sidecars.length }))
    } finally {
      setBusy(false)
    }
  }

  const rejectNames = order.filter(({ id }) => outcomes.get(id)?.reject).map(({ id }) => session.items.find((i) => i.id === id)?.name ?? id)

  return (
    <div className="mt-4 rounded-2xl border border-line p-4" data-testid="cull-export">
      <h3 className="text-sm font-semibold uppercase tracking-widest text-muted">{l.exportTitle}</h3>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <label className="flex items-center gap-2">
          {l.exportStars}
          <select value={s.bestStars} onChange={(e) => set({ bestStars: Number(e.target.value) })} className="border border-line bg-transparent px-1 py-0.5">
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n === 0 ? '—' : '★'.repeat(n)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          {l.exportRejectLabel}
          <select value={s.rejectLabel} onChange={(e) => set({ rejectLabel: e.target.value })} className="border border-line bg-transparent px-1 py-0.5" data-testid="cull-reject-label">
            {LABELS.map((v) => (
              <option key={v} value={v}>
                {labelName(v)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          {l.exportSeriesLabel}
          <select value={s.seriesLabel} onChange={(e) => set({ seriesLabel: e.target.value })} className="border border-line bg-transparent px-1 py-0.5">
            {LABELS.map((v) => (
              <option key={v} value={v}>
                {labelName(v)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={s.duplicatesAreRejects} onChange={(e) => set({ duplicatesAreRejects: e.target.checked })} />
          {l.exportDupes}
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={s.writePickFlag} onChange={(e) => set({ writePickFlag: e.target.checked })} />
          {l.exportPickFlag}
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {hasRaw && scan?.handle && (
          <button type="button" disabled={busy} onClick={writeFolder} className="border border-fg bg-fg px-4 py-2 text-sm text-bg hover:bg-transparent hover:text-fg disabled:opacity-50" data-testid="cull-write">
            {l.writeXmp}
          </button>
        )}
        {hasRaw && (
          <button type="button" disabled={busy} onClick={zip} className={`border px-4 py-2 text-sm disabled:opacity-50 ${scan?.handle ? 'border-line hover:border-fg' : 'border-fg bg-fg text-bg'}`} data-testid="cull-zip">
            {l.zipXmp}
          </button>
        )}
        <button type="button" disabled={busy} onClick={() => download(new Blob([csv()], { type: 'text/csv;charset=utf-8' }), `${session.folderName}-culling.csv`)} className="border border-line px-4 py-2 text-sm hover:border-fg" data-testid="cull-csv">
          {l.csv}
        </button>
        <button
          type="button"
          disabled={rejectNames.length === 0}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(rejectNames.join('\n'))
              setStatus(`${l.copied}: ${rejectNames.length}`)
            } catch {
              /* clipboard blocked */
            }
          }}
          className="border border-line px-4 py-2 text-sm hover:border-fg disabled:opacity-50"
        >
          {l.copyRejects} ({rejectNames.length})
        </button>
      </div>
      {status && (
        <p className="mt-3 text-sm" role="status" data-testid="cull-export-status">
          {status}
        </p>
      )}
      <details className="mt-3 text-xs leading-relaxed text-muted" open={!session.exportedAt}>
        <summary className="cursor-pointer">Lightroom / Capture One</summary>
        <p className="mt-2">{l.howTo}</p>
        <p className="mt-2">{l.howToC1}</p>
        {hasJpeg && <p className="mt-2">{l.jpegNote}</p>}
      </details>
    </div>
  )
}
