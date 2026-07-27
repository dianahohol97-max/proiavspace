'use client'

import { useState, useTransition } from 'react'

/**
 * Manage-grid photo tile: clicking the photo aims the crop focus (0–100%)
 * used by the uniform gallery layouts (squares / portrait / collage /
 * editorial). The thumbnail itself re-crops via object-position so the
 * photographer sees the effect instantly; a dot marks the chosen point.
 */
export function AssetFocusTile({
  url,
  isVideo,
  initialX,
  initialY,
  action,
  title,
}: {
  url: string
  isVideo: boolean
  initialX: number | null
  initialY: number | null
  action: (x: number, y: number) => Promise<void>
  title: string
}) {
  const [fx, setFx] = useState(initialX ?? 50)
  const [fy, setFy] = useState(initialY ?? 50)
  const [touched, setTouched] = useState(initialX !== null)
  const [, startTransition] = useTransition()

  return (
    <button
      type="button"
      title={title}
      className="absolute inset-0 h-full w-full cursor-crosshair"
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect()
        const x = Math.round(((event.clientX - rect.left) / rect.width) * 100)
        const y = Math.round(((event.clientY - rect.top) / rect.height) * 100)
        setFx(x)
        setFy(y)
        setTouched(true)
        startTransition(async () => {
          await action(x, y).catch(() => {})
        })
      }}
    >
      {isVideo ? (
        <video
          src={url}
          className="h-full w-full object-cover"
          style={{ objectPosition: `${fx}% ${fy}%` }}
          muted
          preload="metadata"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
          style={{ objectPosition: `${fx}% ${fy}%` }}
        />
      )}
      {touched && (
        <span
          className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,.4)]"
          style={{ left: `${fx}%`, top: `${fy}%` }}
        />
      )}
    </button>
  )
}
