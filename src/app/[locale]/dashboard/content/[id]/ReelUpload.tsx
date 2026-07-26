'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'

/** Upload a finished reel video: presign → direct PUT to R2 → mark ready. */
export function ReelUpload({ postId }: { postId: string }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const pres = await fetch('/api/social/video/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, contentType: file.type, sizeBytes: file.size }),
      })
      if (!pres.ok) throw new Error('presign')
      const { url, key } = (await pres.json()) as { url: string; key: string }

      const put = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })
      if (!put.ok) throw new Error('upload')

      const done = await fetch('/api/social/video/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, key }),
      })
      if (!done.ok) throw new Error('complete')
      router.refresh()
    } catch {
      setError('Не вдалося завантажити. Спробуй ще раз (MP4/MOV, до 500 МБ).')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="rounded-2xl border border-dashed border-line p-4">
      <p className="text-sm font-bold text-fg">Завантажити готове відео</p>
      <p className="mb-3 text-xs text-muted">
        MP4 або MOV, вертикальне 9:16. Після завантаження статус стане «готово» і рілс піде на
        затвердження.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/*"
        disabled={busy}
        onChange={onFile}
        className="block w-full text-sm text-muted file:mr-3 file:rounded-full file:border-0 file:bg-accent file:px-4 file:py-2 file:text-xs file:font-bold file:text-white"
      />
      {busy && <p className="mt-2 text-xs text-muted">Завантаження… не закривай сторінку.</p>}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}
