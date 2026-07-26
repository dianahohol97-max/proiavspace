'use client'

import { useEffect, useState } from 'react'

declare global {
  interface Window {
    __mut?: string[]
  }
}

/**
 * Reads the mutation log collected by the inline observer (installed
 * pre-hydration by the diag page) and renders a forensic report: user agent,
 * <html> state, and every foreign DOM mutation seen since page start.
 * Everything renders inside #diag-out, which the observer ignores.
 */
export function DiagReport() {
  const [report, setReport] = useState('Збираю дані… зачекайте ~10 секунд.')

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const muts = window.__mut ?? ['(лог порожній — спостерігач не запустився)']
        const counts = new Map<string, number>()
        for (const m of muts) {
          const key = m.split('>')[0] + '>'
          counts.set(key, (counts.get(key) ?? 0) + 1)
        }
        const summary = [...counts.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([k, n]) => `${n}× ${k}`)
          .join('\n')
        const html = document.documentElement
        const attrs = html
          .getAttributeNames()
          .map((a) => `${a}="${String(html.getAttribute(a)).slice(0, 80)}"`)
          .join(' ')
        const lines = [
          '=== ДІАГНОСТИКА ПРОЯВ ===',
          `Браузер: ${navigator.userAgent}`,
          `<html ${attrs}>`,
          `Мутацій зафіксовано: ${muts.length}`,
          '',
          '--- Підсумок за тегами ---',
          summary || '(жодної сторонньої мутації не помічено)',
          '',
          '--- Перші 40 подій ---',
          ...muts.slice(0, 40),
        ]
        setReport(lines.join('\n'))
      } catch (e) {
        setReport('Помилка звіту: ' + (e as Error).message)
      }
    }, 10000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <pre
      style={{
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        fontSize: 12,
        lineHeight: 1.5,
        background: '#111',
        color: '#9f9',
        padding: 16,
        borderRadius: 8,
        minHeight: 300,
      }}
    >
      {report}
    </pre>
  )
}
