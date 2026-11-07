'use client'

/**
 * Renders one spread/cover at a given scale (CSS px per mm). Pure DOM/SVG:
 * each slot is an overflow-hidden box with the preview <img> placed by the
 * same placement() the export uses (zoom, focal point, rotation); text is an
 * SVG layer positioned by baseline, like the canvas and the PDF. Interactive
 * mode adds selection, panning, wheel zoom, drag-and-drop of photos (one or
 * several), slot swapping and moving text; read-only mode is used for
 * thumbnails and the phone viewer.
 */
import { memo, useEffect, useRef, useState } from 'react'
import { dpiLevel, effectiveDpi, slotImageStyle } from '@/lib/album/crop'
import { fontById } from '@/lib/album/fonts'
import { formatFor, safeBoxes, sheetSizeMm } from '@/lib/album/geometry'
import { baselineOffsets, lineStart, ptToMm, textLines } from '@/lib/album/texts'
import type { AlbumPhoto, AlbumSlot, AlbumSpread, AlbumText, PrintSpec } from '@/lib/album/types'

export const DND_PHOTO = 'application/x-proiav-photo'
export const DND_PHOTOS = 'application/x-proiav-photos'
export const DND_SLOT = 'application/x-proiav-slot'

export type Selection = { type: 'slot' | 'text'; id: string } | null

export interface SpreadViewHandlers {
  onSelect(selection: Selection): void
  /** Photos (from the strip) dropped onto a slot, or onto the spread (slotId null). */
  onDropPhotos(slotId: string | null, photoIds: string[]): void
  onSwapSlots(fromSlotId: string, toSlotId: string): void
  /** Live pan; gesture identifies one drag for undo coalescing. */
  onPan(slotId: string, dxMm: number, dyMm: number, gesture: number): void
  onZoom(slotId: string, factor: number, gesture: number): void
  onMoveText(textId: string, dxMm: number, dyMm: number, gesture: number): void
}

interface Props {
  spread: AlbumSpread
  spec: PrintSpec
  photos: Map<string, AlbumPhoto>
  scale: number
  showGuides?: boolean
  selected?: Selection
  handlers?: SpreadViewHandlers
  /** Thumbnails: use small renditions, no DPI badges. */
  thumbs?: boolean
  /** Read-only viewing (phone): no DPI badges. */
  plain?: boolean
  /** Widest line (mm) of a text, measured with its font — for the hit box. */
  measure?: (t: AlbumText) => number
}

let gestureSeq = 0

function SlotImage({ slot, photo, wPx, thumbs }: { slot: AlbumSlot; photo: AlbumPhoto; wPx: number; thumbs?: boolean }) {
  const style = slotImageStyle(photo.width, photo.height, slot.w, slot.h, wPx, slot.zoom, slot.fx, slot.fy, slot.rotation ?? 0)
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={thumbs ? photo.thumbUrl || photo.previewUrl : photo.previewUrl || photo.thumbUrl}
      alt=""
      draggable={false}
      className="pointer-events-none absolute max-w-none select-none"
      style={style}
    />
  )
}

function readDrop(e: React.DragEvent): { photos: string[]; slot: string } {
  let photos: string[] = []
  try {
    const many = e.dataTransfer.getData(DND_PHOTOS)
    if (many) photos = JSON.parse(many) as string[]
  } catch {
    photos = []
  }
  if (!photos.length) {
    const one = e.dataTransfer.getData(DND_PHOTO)
    if (one) photos = [one]
  }
  return { photos, slot: e.dataTransfer.getData(DND_SLOT) }
}

function SpreadViewInner({ spread, spec, photos, scale, showGuides = false, selected, handlers, thumbs, plain, measure }: Props) {
  const format = formatFor(spec, spread)
  const sheet = sheetSizeMm(format)
  const b = format.bleedMm
  const px = (mm: number) => mm * scale
  const interactive = !!handlers
  const [dropTarget, setDropTarget] = useState<string | null>(null)

  const dragAccepts = (e: React.DragEvent) =>
    e.dataTransfer.types.includes(DND_PHOTO) || e.dataTransfer.types.includes(DND_PHOTOS) || e.dataTransfer.types.includes(DND_SLOT)

  const onDrop = (slotId: string | null) => (e: React.DragEvent) => {
    if (!handlers || !dragAccepts(e)) return
    e.preventDefault()
    e.stopPropagation()
    setDropTarget(null)
    const { photos: ids, slot } = readDrop(e)
    if (ids.length) handlers.onDropPhotos(ids.length > 1 ? null : slotId, ids)
    else if (slot && slotId && slot !== slotId) handlers.onSwapSlots(slot, slotId)
  }

  const texts = spread.texts ?? []

  return (
    <div
      className="relative overflow-hidden bg-white shadow-[0_1px_8px_rgba(0,0,0,.18)]"
      style={{ width: px(sheet.widthMm), height: px(sheet.heightMm) }}
      data-testid={thumbs ? undefined : 'spread-sheet'}
      onDragOver={interactive ? (e) => dragAccepts(e) && e.preventDefault() : undefined}
      onDrop={interactive ? onDrop(null) : undefined}
      onPointerDown={interactive ? (e) => e.target === e.currentTarget && handlers!.onSelect(null) : undefined}
    >
      {spread.slots.map((slot, index) => {
        const photo = slot.assetId ? photos.get(slot.assetId) : undefined
        const wPx = px(slot.w)
        const hPx = px(slot.h)
        const dpi = photo ? effectiveDpi(photo.width, photo.height, slot.w, slot.h, slot.zoom, slot.rotation ?? 0) : 0
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
            selected={selected?.type === 'slot' && selected.id === slot.id}
            dropping={dropTarget === slot.id}
            handlers={handlers}
            scale={scale}
            hasPhoto={!!photo}
            onDragEnter={() => setDropTarget(slot.id)}
            onDragLeave={() => setDropTarget((t) => (t === slot.id ? null : t))}
            onDrop={onDrop(slot.id)}
            dragAccepts={dragAccepts}
          >
            {photo && <SlotImage slot={slot} photo={photo} wPx={wPx} thumbs={thumbs} />}
            {!thumbs && !plain && photo && level !== 'ok' && (
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

      {texts.length > 0 && (
        <svg
          className="pointer-events-none absolute inset-0"
          width={px(sheet.widthMm)}
          height={px(sheet.heightMm)}
          viewBox={`${-b} ${-b} ${sheet.widthMm} ${sheet.heightMm}`}
          data-testid={thumbs ? undefined : 'text-layer'}
        >
          {texts.map((t) => (
            <TextItem key={t.id} t={t} scale={scale} handlers={handlers} selected={selected?.type === 'text' && selected.id === t.id} measure={measure} />
          ))}
        </svg>
      )}

      {showGuides && (
        <div className="pointer-events-none absolute inset-0" data-testid="guides">
          {/* bleed zone: everything outside the trim gets tinted */}
          <div className="absolute border-red-500/35" style={{ inset: 0, borderWidth: px(b), borderStyle: 'solid' }} title="Виліт" />
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
              title={`Корінець ${format.spineMm} мм`}
              data-testid="spine-guide"
            />
          ) : (
            <div className="absolute w-px bg-fuchsia-500/70" style={{ left: px(b + format.widthMm / 2), top: 0, height: px(sheet.heightMm) }} title="Згин" />
          )}
        </div>
      )}
    </div>
  )
}

function TextItem({
  t,
  scale,
  handlers,
  selected,
  measure,
}: {
  t: AlbumText
  scale: number
  handlers?: SpreadViewHandlers
  selected: boolean
  measure?: (t: AlbumText) => number
}) {
  const drag = useRef<{ x: number; y: number; gesture: number } | null>(null)
  const size = ptToMm(t.sizePt)
  const offsets = baselineOffsets(t)
  const lines = textLines(t.text)
  const anchor = t.align === 'center' ? 'middle' : t.align === 'right' ? 'end' : 'start'
  const widest = measure ? measure(t) : size * 0.55 * Math.max(...lines.map((l) => l.length), 1)
  const box = {
    x: lineStart(t.align, widest) - size * 0.1,
    y: -0.9 * size,
    w: widest + size * 0.2,
    h: offsets[offsets.length - 1]! + 1.25 * size,
  }
  return (
    <g transform={`translate(${t.x} ${t.y}) rotate(${t.rotation})`} data-testid={handlers ? 'text-item' : undefined}>
      {handlers && (
        <rect
          x={box.x}
          y={box.y}
          width={box.w}
          height={box.h}
          fill="transparent"
          stroke={selected ? 'var(--color-fg)' : 'transparent'}
          strokeWidth={1.5 / scale}
          strokeDasharray={`${4 / scale} ${3 / scale}`}
          className="cursor-move"
          style={{ pointerEvents: 'all' }}
          role="button"
          aria-label={`Текст: ${lines[0]}`}
          aria-pressed={selected}
          onPointerDown={(e) => {
            e.stopPropagation()
            handlers.onSelect({ type: 'text', id: t.id })
            drag.current = { x: e.clientX, y: e.clientY, gesture: ++gestureSeq }
            ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
          }}
          onPointerMove={(e) => {
            const d = drag.current
            if (!d) return
            const dx = e.clientX - d.x
            const dy = e.clientY - d.y
            if (Math.hypot(dx, dy) < 2) return
            d.x = e.clientX
            d.y = e.clientY
            handlers.onMoveText(t.id, dx / scale, dy / scale, d.gesture)
          }}
          onPointerUp={() => {
            drag.current = null
          }}
        />
      )}
      <text
        fontFamily={`"${fontById(t.font).family}"`}
        fontSize={size}
        fill={t.color}
        textAnchor={anchor}
        style={{ fontKerning: 'normal', whiteSpace: 'pre' }}
        className="select-none"
      >
        {lines.map((line, i) => (
          <tspan key={i} x={0} y={offsets[i]}>
            {line || ' '}
          </tspan>
        ))}
      </text>
    </g>
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
        handlers.onSelect({ type: 'slot', id: slot.id })
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
