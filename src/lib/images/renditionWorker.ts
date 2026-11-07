'use client'

/**
 * The one place that knows how the rendition worker is bundled: webpack (Next)
 * turns `new Worker(new URL(...), import.meta.url)` into its own chunk.
 */
export function createRenditionWorker(): Worker {
  return new Worker(new URL('./renditions.worker.ts', import.meta.url))
}
