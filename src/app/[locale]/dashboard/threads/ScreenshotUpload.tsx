'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'

/**
 * Upload a screenshot of any Threads post → the server reads it (Gemini
 * vision), extracts the post text and drafts an on-voice comment. The draft
 * appears in the «На затвердження» list after refresh.
 */
export function ScreenshotUpload() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const urlRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('image', file)
      if (urlRef.current?.value) form.append('source_url', urlRef.current.value.trim())
      const res = await fetch('/api/threads/screenshot', { method: 'POST', body: form })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? 'fail')
      }
      if (urlRef.current) urlRef.current.value = ''
      router.refresh()
    } catch (err) {
      const code = err instanceof Error ? err.message : ''
      setError(
        code === 'not_readable'
          ? 'Не вдалося прочитати пост зі скріншота. Спробуй чіткіший скрін.'
          : code === 'too_large'
            ? 'Файл завеликий (до 8 МБ).'
            : 'Не вдалося обробити скріншот. Спробуй ще раз.'
      )
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="rounded-2xl border border-dashed border-line p-5">
      <p className="text-sm font-bold text-fg">Скріншот поста → коментар</p>
      <p className="mb-3 text-xs text-muted">
        Завантаж скрін будь-якого поста (навіть не про фото) — система прочитає його і
        запропонує коментар у голосі проЯв.
      </p>
      <input
        ref={urlRef}
        placeholder="Лінк на пост (необов'язково — щоб потім швидко відкрити)"
        className="mb-2 w-full rounded-xl border border-line bg-white p-2.5 text-sm text-fg"
      />
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        disabled={busy}
        onChange={onFile}
        className="block w-full text-sm text-muted file:mr-3 file:rounded-full file:border-0 file:bg-accent file:px-4 file:py-2 file:text-xs file:font-bold file:text-white"
      />
      {busy && <p className="mt-2 text-xs text-muted">Читаю скріншот і пишу коментар…</p>}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}
