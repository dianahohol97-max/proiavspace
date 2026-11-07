'use client'

import { useState } from 'react'
import { readPhotoExif } from '@/lib/images/exif'
import { generateImageVariants } from '@/lib/images/variants'
import { resolveContentType } from '@/lib/upload/client'

interface Result {
  name: string
  contentType: string
  takenAt: string | null
  orientation: number | null
  width?: number
  height?: number
  variants: { name: string; type: string; url: string; width: number; height: number }[]
}

function imageSize(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
    image.onerror = () => resolve({ width: 0, height: 0 })
    image.src = url
  })
}

export function UploadPreviewProbe() {
  const [results, setResults] = useState<Result[]>([])
  const [busy, setBusy] = useState(false)
  return (
    <div style={{ padding: 16 }}>
      <input
        type="file"
        multiple
        data-testid="probe-input"
        onChange={async (event) => {
          const files = Array.from(event.target.files ?? [])
          setBusy(true)
          const next: Result[] = []
          for (const file of files) {
            const contentType = await resolveContentType(file)
            const exif = await readPhotoExif(file)
            const rendered = await generateImageVariants(file, undefined, {
              mobile: true,
              hints: { orientation: exif.orientation, rawWidth: exif.rawWidth, rawHeight: exif.rawHeight },
            })
            const variants = await Promise.all(
              rendered.variants.map(async (v) => {
                const url = URL.createObjectURL(v.blob)
                return { name: v.name, type: v.contentType, url, ...(await imageSize(url)) }
              })
            )
            next.push({ name: file.name, contentType, takenAt: exif.takenAt, orientation: exif.orientation, width: rendered.width, height: rendered.height, variants })
          }
          setResults(next)
          setBusy(false)
        }}
      />
      <p data-testid="probe-state">{busy ? 'busy' : results.length ? 'done' : 'idle'}</p>
      <pre data-testid="probe-json">{JSON.stringify(results.map(({ variants, ...rest }) => ({ ...rest, variants: variants.map(({ url: _url, ...v }) => v) })))}</pre>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {results.flatMap((r) =>
          r.variants.map((v) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${r.name}-${v.name}`}
              src={v.url}
              alt={`${r.name} ${v.name}`}
              data-file={r.name}
              data-variant={v.name}
              style={{ height: 160 }}
            />
          ))
        )}
      </div>
    </div>
  )
}
