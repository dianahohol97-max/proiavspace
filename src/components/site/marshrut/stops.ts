/**
 * «Де я буду»: the «фірмовий кадр» phrase read as stops — «Карпати 12–14;
 * Львів 18–19; Одеса 25–27» (separated by «;» or new lines). Each stop is a
 * place and an optional date part (whatever follows the first digit).
 */
export function parseStops(text: string): { place: string; when: string }[] {
  return text
    .split(/[;\n]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 6)
    .map((part) => {
      const m = /^(.*?)(\s+(?:з|до|from|to)?\s*\d.*)?$/i.exec(part)
      return { place: (m?.[1] ?? part).trim(), when: (m?.[2] ?? '').trim() }
    })
}

/** Points along a gentle zigzag across a 1000×600 map for n stops. */
export function routePoints(n: number): { x: number; y: number }[] {
  const ys = [420, 180, 360, 140, 300, 200]
  return Array.from({ length: n }, (_, i) => ({
    x: Math.round(110 + (i * 780) / Math.max(n - 1, 1)),
    y: ys[i % ys.length],
  }))
}

/** A smooth path through the points (quadratic midpoints). */
export function routePath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return ''
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    const cx = (a.x + b.x) / 2
    d += ` C ${cx} ${a.y}, ${cx} ${b.y}, ${b.x} ${b.y}`
  }
  return d
}
