/**
 * Ready-made Instagram Stories sets, rendered by the content factory and
 * published to its repo. The factory writes queue/stories_queue.json with a
 * RAW url per frame; the admin «Сторіс» tab lists them for download.
 */

const FACTORY_RAW =
  'https://raw.githubusercontent.com/dianahohol97-max/proyav-content-factory/main'

export interface StorySet {
  id: string
  title: string
  frames: string[]
}

export async function getStorySets(): Promise<StorySet[]> {
  try {
    const res = await fetch(`${FACTORY_RAW}/queue/stories_queue.json`, {
      // The factory pushes rarely; a short cache keeps the tab snappy while
      // still picking up fresh sets within a minute.
      next: { revalidate: 60 },
    })
    if (!res.ok) return []
    const items = (await res.json()) as StorySet[]
    return Array.isArray(items)
      ? items.filter((s) => s && typeof s.id === 'string' && Array.isArray(s.frames))
      : []
  } catch {
    return []
  }
}

/** Only factory-repo files may be proxied for download (no open proxy). */
export function isAllowedFrameUrl(url: string): boolean {
  return url.startsWith(`${FACTORY_RAW}/`)
}
