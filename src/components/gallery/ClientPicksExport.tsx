'use client'

import { useState } from 'react'

export interface ClientPicksExportLabels {
  copy: string
  copied: string
  copyFailed: string
  hint: string
  substringNote: string
  lineLabel: string
  skipped: string
  download: string
}

/**
 * «Обране клієнта» → Lightroom Classic: one button copies the filter line
 * (names without extensions, comma-separated — lib/gallery/client-picks),
 * the hint says where to paste it, and the line itself stays visible and
 * selectable in case the clipboard is blocked. «Завантажити список» gives the
 * full list (name, heart/retouch, comment) as .txt or .csv.
 */
export function ClientPicksExport({
  line,
  count,
  skipped,
  txt,
  csv,
  fileBase,
  labels,
}: {
  line: string
  count: number
  skipped: string[]
  txt: string
  csv: string
  fileBase: string
  labels: ClientPicksExportLabels
}) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')

  async function copy() {
    try {
      await navigator.clipboard.writeText(line)
      setCopyState('copied')
      window.setTimeout(() => setCopyState('idle'), 2500)
    } catch {
      setCopyState('failed')
    }
  }

  function download(kind: 'txt' | 'csv') {
    const blob = new Blob([kind === 'txt' ? txt : csv], {
      type: kind === 'txt' ? 'text/plain;charset=utf-8' : 'text/csv;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${fileBase}.${kind}`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const buttonClass =
    'min-h-[44px] border border-line px-5 py-2 text-sm uppercase tracking-widest text-muted transition-colors hover:border-fg hover:text-fg'

  return (
    <div className="mt-5 max-w-3xl" data-testid="client-picks-export">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void copy()}
          disabled={count === 0}
          className={`${buttonClass} disabled:opacity-40`}
          data-testid="picks-copy"
        >
          {copyState === 'copied' ? labels.copied : labels.copy}
        </button>
        <span className="text-sm text-muted">{labels.download}:</span>
        <button type="button" onClick={() => download('txt')} className={buttonClass} data-testid="picks-txt">
          .txt
        </button>
        <button type="button" onClick={() => download('csv')} className={buttonClass} data-testid="picks-csv">
          .csv
        </button>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted">{labels.hint}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted">{labels.substringNote}</p>

      {copyState === 'failed' && (
        <p className="mt-2 text-sm text-accent" role="status">
          {labels.copyFailed}
        </p>
      )}

      {count > 0 && (
        <label className="mt-4 block">
          <span className="text-xs text-muted">{labels.lineLabel.replace('{n}', String(count))}</span>
          <textarea
            readOnly
            value={line}
            rows={Math.min(4, Math.max(1, Math.ceil(line.length / 90)))}
            onFocus={(event) => event.currentTarget.select()}
            className="mt-1 block w-full resize-y border border-line bg-transparent px-3 py-2 font-mono text-xs leading-relaxed outline-none focus:border-fg"
            data-testid="picks-line"
          />
        </label>
      )}

      {skipped.length > 0 && (
        <div className="mt-3 text-xs leading-relaxed text-accent" data-testid="picks-skipped">
          <p>{labels.skipped}</p>
          <p className="mt-1 break-all font-mono">{skipped.join(' · ')}</p>
        </div>
      )}
    </div>
  )
}
