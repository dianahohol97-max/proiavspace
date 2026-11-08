'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { readPhotoExif } from '@/lib/images/exif'

/**
 * Test-only uploader: the real EXIF read of lib/upload/client.ts, then the
 * in-memory registration and the same «batch done» hook the real Uploader
 * calls (onBatchDone). No storage involved.
 */
export function ProbeUploader({
  register,
  onBatchDone,
}: {
  register: (name: string, takenAt: string | null) => Promise<void>
  onBatchDone: () => Promise<unknown>
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  return (
    <label className="block">
      <input
        type="file"
        multiple
        data-testid="sort-upload"
        disabled={busy}
        onChange={async (event) => {
          const files = Array.from(event.target.files ?? [])
          event.target.value = ''
          setBusy(true)
          for (const file of files) {
            const exif = await readPhotoExif(file)
            await register(file.name, exif.takenAt)
          }
          await onBatchDone()
          router.refresh()
          setBusy(false)
        }}
      />
      <span data-testid="sort-upload-state">{busy ? 'busy' : 'idle'}</span>
    </label>
  )
}
