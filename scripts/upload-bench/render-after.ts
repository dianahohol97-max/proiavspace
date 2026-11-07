import { generateRenditions } from '@/lib/images/renditionPool'
// New: 8 files in flight, the pool decodes 2 at a time in workers.
;(window as unknown as Record<string, unknown>).render = (files: File[]) => pool(files, 8, (f) => generateRenditions(f, 'Studio Test', { mobile: true }))
async function pool(files: File[], n: number, fn: (f: File) => Promise<{ variants: { blob: Blob }[] }>) {
  const q = [...files]; let bytes = 0; let count = 0
  await Promise.all(Array.from({ length: n }, async () => { for (let f = q.shift(); f; f = q.shift()) { const r = await fn(f); count += r.variants.length; bytes += r.variants.reduce((s, v) => s + v.blob.size, 0) } }))
  return { count, bytes }
}
