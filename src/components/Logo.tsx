/**
 * Brand mark: a viewfinder frame with the image "developing" in the middle —
 * literally «прояв». Works one-colored at any size; the dot is the accent.
 */
export function LogoMark({ size = 23 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 8V5.5A2.5 2.5 0 0 1 5.5 3H8M16 3h2.5A2.5 2.5 0 0 1 21 5.5V8M21 16v2.5a2.5 2.5 0 0 1-2.5 2.5H16M8 21H5.5A2.5 2.5 0 0 1 3 18.5V16"
        stroke="currentColor"
        strokeWidth="2.3"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="3.6" fill="var(--color-accent)" />
    </svg>
  )
}

/**
 * Wordmark: «проЯв» — the capital Я inside the word is the photographer's
 * "я" surfacing, набране фірмовим синім.
 */
export function Wordmark({ textSize = 15 }: { textSize?: number }) {
  return (
    // font-wordmark: a 2.8 KB Unbounded subset of these letters (globals.css)
    <b className="font-wordmark font-semibold tracking-[.01em]" style={{ fontSize: textSize }}>
      про<span className="text-accent">Я</span>в
    </b>
  )
}

export function Logo({ size = 23, textSize = 15 }: { size?: number; textSize?: number }) {
  return (
    <span className="inline-flex items-center gap-[11px]">
      <LogoMark size={size} />
      <Wordmark textSize={textSize} />
    </span>
  )
}
