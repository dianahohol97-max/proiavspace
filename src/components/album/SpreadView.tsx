'use client'

/**
 * Renders one spread/cover at a given scale (CSS px per mm). Pure DOM: each
 * slot is an overflow-hidden box with the preview <img> placed by the same
 * computeCrop the export uses. Interactive mode adds selection, panning,
 * wheel zoom, drag-and-drop of photos and slot swapping; read-only mode is
 * used for thumbnails and the phone viewer.
 */
import { memo, useEffect, useRef, useState } from 'react'
import { computeCrop, dpiLevel, effectiveDpi } from '@/lib/album/crop'
import { formatFor, safeBoxes, sheetSizeMm } from '@/lib/album/geometry'
import type { AlbumPhoto, AlbumSlot, AlbumSpread, PrintSpec } from '@/lib/album/types'

export const DND_PHOTO = 'application/x-proiav-photo'
export const DND_SLOT = 'application/x-proiav-slot'

export interface SpreadViewHandlers {
  onSelectSlot(slotId: string | null): void
  /** Drop of a photo (from the strip) onto a slot, or onto an empty spread (slotId null). */
  onDropPhoto(slotId: string | null, photoId: string): void
  onSwapSlots(fromSlotId: string, toSlotId: string): void
  /** Live pan; gesture identifies one drag for undo coalescing. */
  onPan(slotId: string, dxMm: number, dyMm: number, gesture: number): void
  onZoom(slotId: string, factor: number, gesture: number): void
}

interface Props {
  spread: AlbumSpread
  spec: PrintSpec
  photos: Map<string, AlbumPhoto>
  scale: number
  showGuides?: boolean
  selectedSlotId?: string | null
  handlers?: SpreadViewHandlers
  /** Thumbnails: use small renditions, no DPI badges. */
  thumbs?: boolean
}

let gestureSeq = 0

function SlotImage({ slot, photo, wPx, hPx, thumbs }: { slot: AlbumSlot; photo: AlbumPhoto; wPx: number; hPx: number; thumbs?: boolean }) {
  const crop = computeCrop(photo.width, photo.height, slot.w, slot.h, slot.zoom, slot.fx, slot.fy)
  const imgW = wPx / crop.w
  const imgH = hPx / crop.h
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={thumbs ? photo.thumbUrl || photo.previewUrl : photo.previewUrl || photo.thumbUrl}
      alt=""
      draggable={false}
      className="pointer-events-none absolute max-w-none select-none"
      style={{ width: imgW, height: imgH, left: -crop.x * imgW, top: -crop.y * imgH }}
    />
  )
}

function SpreadViewInner({ spread, spec, photos, scale, showGuides = false, selectedSlotId, handlers, thumbs }: Props) {
  const format = formatFor(spec, spread.kind)
  const sheet = sheetSizeMm(format)
  const b = format.bleedMm
  const px = (mm: number) => mm * scale
  const interactive = !!handlers
  const [dropTarget, setDropTarget] = useState<string | null>(null)

  const dragAccepts = (e: React.DragEvent) =>
    e.dataTransfer.types.includes(DND_PHOTO) || e.dataTransfer.types.includes(DND_SLOT)

  const onDrop = (slotId: string | null) => (e: React.DragEvent) => {
    if (!handlers || !dragAccepts(e)) return
    e.preventDefault()
    e.stopPropagation()
    setDropTarget(null)
    const photoId = e.dataTransfer.getData(DND_PHOTO)
    const fromSlot = e.dataTransfer.getData(DND_SLOT)
    if (photoId) handlers.onDropPhoto(slotId, photoId)
    else if (fromSlot && slotId && fromSlot !== slotId) handlers.onSwapSlots(fromSlot, slotId)
  }

  return (
    <div
      className="relative overflow-hidden bg-white shadow-[0_1px_8px_rgba(0,0,0,.18)]"
      style={{ width: px(sheet.widthMm), height: px(sheet.heightMm) }}
      data-testid={thumbs ? undefined : 'spread-sheet'}
      onDragOver={interactive ? (e) => dragAccepts(e) && e.preventDefault() : undefined}
      onDrop={interactive ? onDrop(null) : undefined}
      onPointerDown={interactive ? (e) => e.target === e.currentTarget && handlers!.onSelectSlot(null) : undefined}
    >
      {spread.slots.map((slot, index) => {
        const photo = slot.assetId ? photos.get(slot.assetId) : undefined
        const wPx = px(slot.w)
        const hPx = px(slot.h)
        const dpi = photo ? effectiveDpi(photo.width, photo.height, slot.w, slot.h, slot.zoom) : 0
        const level = photo ? dpiLevel(dpi, spec.dpi) : 'ok'
        return (
          <SlotBox
            key={slot.id}
            slot={slot}
            index={index}
            left={px(slot.x + b)}
            top={px(slot.y + b)}
            width={wPx}
            height={hPx}
            selected={selectedSlotId === slot.id}
            dropping={dropTarget === slot.id}
            handlers={handlers}
            scale={scale}
            hasPhoto={!!photo}
            onDragEnter={() => setDropTarget(slot.id)}
            onDragLeave={() => setDropTarget((t) => (t === slot.id ? null : t))}
            onDrop={onDrop(slot.id)}
            dragAccepts={dragAccepts}
          >
            {photo && <SlotImage slot={slot} photo={photo} wPx={wPx} hPx={hPx} thumbs={thumbs} />}
            {!thumbs && photo && level !== 'ok' && (
              <span
                className={`pointer-events-none absolute right-1.5 top-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold text-white ${level === 'bad' ? 'bg-red-600' : 'bg-amber-500'}`}
                data-testid="dpi-warning"
                title={`Фото дає ${Math.round(dpi)} DPI при потрібних ${spec.dpi}`}
              >
                ⚠ {Math.round(dpi)} DPI
              </span>
            )}
          </SlotBox>
        )
      })}

      {showGuides && (
        <div className="pointer-events-none absolute inset-0" data-testid="guides">
          {/* bleed zone: everything outside the trim gets tinted */}
          <div
            className="absolute border-red-500/35"
            style={{ inset: 0, borderWidth: px(b), borderStyle: 'solid' }}
            title="Виліт"
          />
          <div className="absolute border border-red-500" style={{ left: px(b), top: px(b), width: px(format.widthMm), height: px(format.heightMm) }} />
          {safeBoxes(format).map((box, i) => (
            <div
              key={i}
              className="absolute border border-dashed border-sky-500"
              style={{ left: px(box.x + b), top: px(box.y + b), width: px(box.w), height: px(box.h) }}
            />
          ))}
          {format.spineMm > 0 ? (
            <div
              className="absolute bg-fuchsia-500/15 outline outline-1 outline-fuchsia-500"
              style={{ left: px(b + (format.widthMm - format.spineMm) / 2), top: 0, width: px(format.spineMm), height: px(sheet.heightMm) }}
              title="Корінець"
            />
          ) : (
            <div className="absolute w-px bg-fuchsia-500/70" style={{ left: px(b + format.widthMm / 2), top: 0, height: px(sheet.heightMm) }} title="Згин" />
          )}
        </div>
      )}
    </div>
  )
}

interface SlotBoxProps {
  slot: AlbumSlot
  index: number
  left: number
  top: number
  width: number
  height: number
  selected: boolean
  dropping: boolean
  hasPhoto: boolean
  scale: number
  handlers?: SpreadViewHandlers
  children: React.ReactNode
  onDragEnter(): void
  onDragLeave(): void
  onDrop(e: React.DragEvent): void
  dragAccepts(e: React.DragEvent): boolean
}

function SlotBox(props: SlotBoxProps) {
  const { slot, handlers, scale } = props
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; gesture: number; moved: boolean } | null>(null)
  const wheelGesture = useRef<{ id: number; at: number }>({ id: 0, at: 0 })

  // Wheel zoom needs a non-passive listener to stop the page from scrolling.
  useEffect(() => {
    const el = ref.current
    if (!el || !handlers || !props.hasPhoto) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const now = performance.now()
      if (now - wheelGesture.current.at > 600) wheelGesture.current.id = ++gestureSeq
      wheelGesture.current.at = now
      handlers.onZoom(slot.id, Math.exp(-e.deltaY * 0.0015), wheelGesture.current.id)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [handlers, slot.id, props.hasPhoto])

  if (!handlers) {
    return (
      <div className="absolute overflow-hidden bg-neutral-200" style={{ left: props.left, top: props.top, width: props.width, height: props.height }}>
        {props.children}
      </div>
    )
  }

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      aria-label={`Слот ${props.index + 1}${props.hasPhoto ? '' : ' (порожній)'}`}
      aria-pressed={props.selected}
      data-testid="slot"
      data-filled={props.hasPhoto ? 'true' : 'false'}
      className={`group absolute touch-none overflow-hidden ${props.hasPhoto ? 'cursor-grab bg-neutral-200 active:cursor-grabbing' : 'cursor-pointer bg-neutral-100'} ${
        props.dropping ? 'outline outline-4 -outline-offset-4 outline-accent' : props.selected ? 'outline outline-2 -outline-offset-2 outline-fg' : ''
      }`}
      style={{ left: props.left, top: props.top, width: props.width, height: props.height }}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('[data-swap-handle]')) return
        handlers.onSelectSlot(slot.id)
        if (!props.hasPhoto || e.button !== 0) return
        drag.current = { x: e.clientX, y: e.clientY, gesture: ++gestureSeq, moved: false }
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        const d = drag.current
        if (!d) return
        const dx = e.clientX - d.x
        const dy = e.clientY - d.y
        if (!d.moved && Math.hypot(dx, dy) < 3) return
        d.moved = true
        d.x = e.clientX
        d.y = e.clientY
        handlers.onPan(slot.id, dx / scale, dy / scale, d.gesture)
      }}
      onPointerUp={() => {
        drag.current = null
      }}
      onPointerCancel={() => {
        drag.current = null
      }}
      onDragOver={(e) => {
        if (props.dragAccepts(e)) {
          e.preventDefault()
          e.stopPropagation()
        }
      }}
      onDragEnter={props.onDragEnter}
      onDragLeave={props.onDragLeave}
      onDrop={props.onDrop}
    >
      {props.children}
      {!props.hasPhoto && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-center text-[11px] font-semibold text-muted">
          {props.width > 70 ? 'Перетягніть фото' : '+'}
        </span>
      )}
      {props.hasPhoto && (
        <span
          data-swap-handle
          draggable
          title="Перетягніть на інший слот, щоб поміняти фото місцями"
          aria-label="Поміняти місцями"
          className="absolute bottom-1.5 left-1.5 hidden h-7 w-7 cursor-move items-center justify-center rounded-full bg-white/90 text-sm text-fg shadow group-hover:flex group-aria-pressed:flex"
          onDragStart={(e) => {
            e.dataTransfer.setData(DND_SLOT, slot.id)
            e.dataTransfer.effectAllowed = 'move'
          }}
        >
          ⇄
        </span>
      )}
    </div>
  )
}

export const SpreadView = memo(SpreadViewInner)
