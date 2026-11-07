'use client'

/**
 * Full-screen check of one photo: the LARGEST embedded preview of the RAW (or
 * the JPEG itself), «fit» or 100 % (one image pixel per device pixel) to judge
 * focus. Click / Z toggles 100 % around the clicked point; drag pans.
 */
import { useEffect, useRef, useState } from 'react'
import { decode, drawOriented, orientedSize } from '@/lib/folder-cull/orient'
import type { FolderLabels } from '@/lib/folder-cull/i18n'
import type { FolderItem, ItemMeta } from '@/lib/folder-cull/types'

export interface ViewerProps {
  item: FolderItem
  meta: ItemMeta | undefined
  getFile: () => Promise<File>
  labels: FolderLabels
  zoom: boolean
  onZoom: (zoom: boolean) => void
  onClose: () => void
  /** Badges / marks rendered by the parent. */
  overlay?: React.ReactNode
}

export function CullViewer({ item, meta, getFile, labels: l, zoom, onZoom, onClose, overlay }: ViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<[number, number] | null>(null)
  const [error, setError] = useState(false)
  const anchor = useRef<{ fx: number; fy: number } | null>(null)
  const drag = useRef<{ x: number; y: number; sl: number; st: number; moved: boolean } | null>(null)

  useEffect(() => {
    let alive = true
    setSize(null)
    setError(false)
    ;(async () => {
      try {
        const file = await getFile()
        const full = meta?.full
        const blob = item.kind === 'raw' && full ? file.slice(full.offset, full.offset + full.length, 'image/jpeg') : file
        const fromImage = item.kind !== 'raw' || !!full?.selfOriented
        const orientation = item.kind === 'raw' && !full?.selfOriented ? meta?.orientation ?? 1 : 1
        const bitmap = await decode(blob, fromImage)
        if (!alive) return bitmap.close()
        const [W, H] = orientedSize(bitmap.width, bitmap.height, orientation)
        const canvas = canvasRef.current!
        canvas.width = W
        canvas.height = H
        drawOriented(canvas.getContext('2d')!, bitmap, orientation, W, H)
        bitmap.close()
        setSize([W, H])
      } catch {
        if (alive) setError(true)
      }
    })()
    return () => {
      alive = false
    }
  }, [item, meta, getFile])

  // Keep the clicked point under the cursor when switching to 100 %.
  useEffect(() => {
    const box = boxRef.current
    if (!box || !size) return
    if (zoom) {
      const dpr = window.devicePixelRatio || 1
      const a = anchor.current ?? { fx: 0.5, fy: 0.5 }
      box.scrollLeft = a.fx * (size[0] / dpr) - box.clientWidth / 2
      box.scrollTop = a.fy * (size[1] / dpr) - box.clientHeight / 2
    }
  }, [zoom, size])

  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  const style: React.CSSProperties = zoom && size
    ? { width: size[0] / dpr, height: size[1] / dpr, maxWidth: 'none', cursor: 'grab' }
    : { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', cursor: 'zoom-in' }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-950 text-white" role="dialog" aria-modal="true" aria-label={item.name} data-testid="cull-viewer">
      <div className="flex items-center gap-3 px-4 py-2 text-sm">
        <span className="truncate font-semibold">{item.name}</span>
        {size && <span className="text-white/60">{size[0]}×{size[1]}</span>}
        <span className="ml-2">{overlay}</span>
        <span className="ml-auto flex items-center gap-2">
          <button type="button" onClick={() => onZoom(!zoom)} className="rounded-full border border-white/30 px-3 py-1 hover:bg-white hover:text-black" data-testid="cull-zoom">
            {zoom ? l.viewerFit : l.viewer100}
          </button>
          <button type="button" onClick={onClose} className="rounded-full border border-white/30 px-3 py-1 hover:bg-white hover:text-black">
            {l.close}
          </button>
        </span>
      </div>
      <div
        ref={boxRef}
        className={`relative flex-1 ${zoom ? 'overflow-auto' : 'flex items-center justify-center overflow-hidden'}`}
        onMouseDown={(e) => {
          const box = boxRef.current!
          drag.current = { x: e.clientX, y: e.clientY, sl: box.scrollLeft, st: box.scrollTop, moved: false }
        }}
        onMouseMove={(e) => {
          const d = drag.current
          if (!d || !zoom) return
          const box = boxRef.current!
          if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 4) d.moved = true
          box.scrollLeft = d.sl - (e.clientX - d.x)
          box.scrollTop = d.st - (e.clientY - d.y)
        }}
        onMouseUp={() => {
          setTimeout(() => (drag.current = null), 0)
        }}
      >
        {!size && !error && <p className="absolute inset-0 m-auto h-6 text-center text-white/60">{l.loading}</p>}
        {error && <p className="absolute inset-0 m-auto h-6 text-center text-white/60">—</p>}
        <canvas
          ref={canvasRef}
          style={{ ...style, display: size ? 'block' : 'none' }}
          onClick={(e) => {
            if (drag.current?.moved) return
            const r = (e.target as HTMLCanvasElement).getBoundingClientRect()
            anchor.current = { fx: (e.clientX - r.left) / r.width, fy: (e.clientY - r.top) / r.height }
            onZoom(!zoom)
          }}
        />
      </div>
      <p className="px-4 py-2 text-xs text-white/50">{l.viewerHint}</p>
    </div>
  )
}
