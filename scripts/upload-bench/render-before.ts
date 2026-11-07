import { generateImageVariants } from '@/lib/images/variants'
// Old Uploader: up to 5 files at once, each decoding on its own.
;(window as unknown as Record<string, unknown>).render = (files: File[]) => pool(files, 5, (f) => generateImageVariants(f, 'Studio Test', { mobile: true }))
async function pool(files: File[], n: number, fn: (f: File) => Promise<{ variants: { blob: Blob }[] }>) {
  const q = [...files]; let bytes = 0; let count = 0
  await Promise.all(Array.from({ length: n }, async () => { for (let f = q.shift(); f; f = q.shift()) { const r = await fn(f); count += r.variants.length; bytes += r.variants.reduce((s, v) => s + v.blob.size, 0) } }))
  return { count, bytes }
}
