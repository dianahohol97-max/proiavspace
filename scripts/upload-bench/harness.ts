import { uploadFileToGallery } from '@/lib/upload/client'

type Ev = { t: number; file: number; kind: string; value?: unknown }
const w = window as unknown as Record<string, unknown>
const events: Ev[] = []
w.__events = events
let maxLag = 0
let last = performance.now()
setInterval(() => {
  const now = performance.now()
  maxLag = Math.max(maxLag, now - last - 50)
  last = now
}, 50)
let longTasks = 0
let longTaskMs = 0
let longestTask = 0
try {
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      longTasks++
      longTaskMs += e.duration
      longestTask = Math.max(longestTask, e.duration)
    }
  }).observe({ type: 'longtask', buffered: true })
} catch {}

w.resetProbe = () => {
  maxLag = 0; longTasks = 0; longTaskMs = 0; longestTask = 0; last = performance.now()
}
w.probe = () => ({ maxLag: Math.round(maxLag), longTasks, longTaskMs: Math.round(longTaskMs), longestTask: Math.round(longestTask) })

w.runUploads = async (concurrency: number) => {
  const files = Array.from((document.getElementById('f') as HTMLInputElement).files ?? [])
  const t0 = performance.now()
  const doneAt: number[] = []
  const errors: string[] = []
  const queue = files.map((file, index) => ({ file, index }))
  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      for (let next = queue.shift(); next; next = queue.shift()) {
        const { file, index } = next
        events.push({ t: performance.now() - t0, file: index, kind: 'start' })
        try {
          await uploadFileToGallery({
            galleryId: 'G',
            file,
            watermarkText: 'Studio Test',
            onProgress: (p) => { if (p % 10 === 0) events.push({ t: performance.now() - t0, file: index, kind: 'p', value: p }) },
            ...({ onNetworkWait: (wait: boolean) => events.push({ t: performance.now() - t0, file: index, kind: 'wait', value: wait }) } as object),
          } as Parameters<typeof uploadFileToGallery>[0])
          doneAt.push(Math.round(performance.now() - t0))
          events.push({ t: performance.now() - t0, file: index, kind: 'done' })
        } catch (error) {
          errors.push(`${file.name}: ${String(error)}`)
          events.push({ t: performance.now() - t0, file: index, kind: 'error', value: String(error) })
        }
      }
    })
  )
  return { ms: Math.round(performance.now() - t0), doneAt, errors }
}
