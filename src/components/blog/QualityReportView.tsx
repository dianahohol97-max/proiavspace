import type { QualityReport } from '@/lib/blog/generator/types'

/** Generator quality report — shown to the admin next to a draft or revision. */
export function QualityReportView({ report }: { report: QualityReport }) {
  const errors = report.issues.filter((i) => i.level === 'error')
  const warnings = report.issues.filter((i) => i.level === 'warning')
  const s = report.stats
  return (
    <div className={`rounded-2xl border p-5 text-sm ${report.ok ? 'border-emerald-600/30' : 'border-accent/40'}`}>
      <p className={`font-bold ${report.ok ? 'text-emerald-700' : 'text-accent'}`}>
        {report.ok ? 'Перевірку пройдено' : `Помилок: ${errors.length}`}
        {warnings.length > 0 && <span className="font-normal text-muted"> · зауважень: {warnings.length}</span>}
      </p>
      <p className="mt-2 text-muted">
        {report.words} слів · вступ {s.intro} абз. · H2: {s.h2} · таблиць: {s.tables} · FAQ: {s.faq} · зображень:{' '}
        {s.images} · блоків з цінами: {s.prices} · зовнішніх джерел: {s.externalLinks}
      </p>
      <p className="mt-1 text-muted">
        Продукт: {s.productLinks.join(', ') || '—'} · статті: {s.articleLinks.join(', ') || '—'}
      </p>
      {report.issues.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1">
          {[...errors, ...warnings].map((i, n) => (
            <li key={n} className={i.level === 'error' ? 'text-accent' : 'text-muted'}>
              {i.level === 'error' ? '✖' : '•'} [{i.check}] {i.message}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-muted">Перевірено {new Date(report.checkedAt).toLocaleString('uk-UA')}</p>
    </div>
  )
}
