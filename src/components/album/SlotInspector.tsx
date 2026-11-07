'use client'

/**
 * The selected slot: zoom, focal point (click on the full frame), DPI of the
 * photo at this size, remove/replace. Panning is done right on the spread.
 */
import { MAX_ZOOM, computeCrop, dpiLevel, effectiveDpi } from '@/lib/album/crop'
import type { AlbumPhoto, AlbumSlot, PrintSpec } from '@/lib/album/types'
import { btn, label } from './ui'

export function SlotInspector({
  slot,
  photo,
  spec,
  onZoom,
  onFocal,
  onClear,
  onFitReset,
}: {
  slot: AlbumSlot
  photo: AlbumPhoto | undefined
  spec: PrintSpec
  onZoom(zoom: number, gesture: string): void
  onFocal(fx: number, fy: number): void
  onClear(): void
  onFitReset(): void
}) {
  if (!photo) {
    return (
      <p className="text-sm text-muted">
        Порожній слот {Math.round(slot.w)}×{Math.round(slot.h)} мм. Перетягніть сюди фото з плівки внизу.
      </p>
    )
  }
  const dpi = effectiveDpi(photo.width, photo.height, slot.w, slot.h, slot.zoom)
  const level = dpiLevel(dpi, spec.dpi)
  const crop = computeCrop(photo.width, photo.height, slot.w, slot.h, slot.zoom, slot.fx, slot.fy)
  const aspect = photo.width / photo.height

  return (
    <div className="flex flex-col gap-4" data-testid="slot-inspector">
      <div>
        <p className={label}>Фокусна точка</p>
        <p className="mt-1 text-xs text-muted">Клацніть по кадру — ця точка стане центром слота. Тягніть фото на розвороті, щоб зсунути.</p>
        <div
          className="relative mt-2 w-full cursor-crosshair overflow-hidden rounded-md bg-neutral-200"
          style={{ aspectRatio: String(aspect) }}
          data-testid="focal-picker"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            onFocal((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height)
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.thumbUrl || photo.previewUrl} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
          <div
            className="pointer-events-none absolute border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,.45)]"
            style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.w * 100}%`, height: `${crop.h * 100}%` }}
          />
          <div
            className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-accent"
            style={{ left: `${slot.fx * 100}%`, top: `${slot.fy * 100}%` }}
          />
        </div>
      </div>
      <div>
        <label className={label} htmlFor="slot-zoom">
          Масштаб · {Math.round(slot.zoom * 100)}%
        </label>
        <input
          id="slot-zoom"
          type="range"
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          value={slot.zoom}
          onChange={(e) => onZoom(Number(e.target.value), `zoom-${slot.id}`)}
          className="mt-2 w-full accent-[var(--color-fg)]"
        />
        <p className="mt-1 text-xs text-muted">Або коліщатком миші над фото.</p>
      </div>
      <div className={`rounded-xl p-3 text-sm ${level === 'ok' ? 'bg-emerald-50 text-emerald-800' : level === 'low' ? 'bg-amber-50 text-amber-900' : 'bg-red-50 text-red-800'}`} data-testid="slot-dpi">
        <b>{Math.round(dpi)} DPI</b> при потрібних {spec.dpi}
        {level !== 'ok' && <span className="block text-xs">Зменште масштаб або слот — інакше у друці фото буде м'якшим.</span>}
        <span className="mt-1 block text-xs opacity-80">
          Оригінал {photo.width}×{photo.height} px · слот {Math.round(slot.w)}×{Math.round(slot.h)} мм
        </span>
      </div>
      <p className="truncate text-xs text-muted" title={photo.name}>{photo.name}</p>
      <div className="flex flex-wrap gap-2">
        <button className={btn} onClick={onFitReset}>Скинути кадр</button>
        <button className={btn} onClick={onClear}>Прибрати фото</button>
      </div>
    </div>
  )
}
