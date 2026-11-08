'use client'

import { looksLikeHeic, type GeneratedRenditions, type GeneratedVariant, type SourceHints } from './renditionCore'
import { createRenditionWorker } from './renditionWorker'
import type { RenditionJob, RenditionReply } from './renditions.worker'
import { generateImageVariants } from './variants'

/**
 * Rendition generation for gallery uploads, kept OFF the upload's critical
 * path: at most MAX_PARALLEL images decode at once (a 24 MP bitmap is ~100 MB
 * of RAM; 5–6 at once made the tab heavy), each in a Web Worker with an
 * OffscreenCanvas so the main thread never stalls. Browsers without
 * OffscreenCanvas 2D in workers (older Safari) fall back to the main-thread
 * generator, one image at a time.
 */

const MAX_PARALLEL = 2
/** An idle worker is terminated so its decoder memory goes back to the OS. */
const IDLE_MS = 20_000

let workersUnavailable = typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined'

interface Slot {
  worker: Worker | null
  idleTimer: ReturnType<typeof setTimeout> | null
}

const slots: Slot[] = Array.from({ length: MAX_PARALLEL }, () => ({ worker: null, idleTimer: null }))
const freeSlots: Slot[] = [...slots]
const waiting: ((slot: Slot) => void)[] = []
let nextJobId = 1

function acquire(): Promise<Slot> {
  const slot = freeSlots.pop()
  if (slot) return Promise.resolve(slot)
  return new Promise((resolve) => waiting.push(resolve))
}

function release(slot: Slot): void {
  const next = waiting.shift()
  if (next) {
    next(slot)
    return
  }
  freeSlots.push(slot)
  if (slot.worker) {
    slot.idleTimer = setTimeout(() => {
      slot.worker?.terminate()
      slot.worker = null
      slot.idleTimer = null
    }, IDLE_MS)
  }
}

/** Main-thread fallback runs one image at a time even with two slots. */
let mainThreadChain: Promise<unknown> = Promise.resolve()
function onMainThread(
  file: File,
  watermarkText: string | undefined,
  mobile: boolean,
  hints: SourceHints | undefined
): Promise<GeneratedRenditions> {
  const run = mainThreadChain.then(() => generateImageVariants(file, watermarkText, { mobile, hints }))
  mainThreadChain = run.catch(() => undefined)
  return run
}

function runInWorker(slot: Slot, job: RenditionJob): Promise<RenditionReply> {
  if (slot.idleTimer) {
    clearTimeout(slot.idleTimer)
    slot.idleTimer = null
  }
  if (!slot.worker) slot.worker = createRenditionWorker()
  const worker = slot.worker
  return new Promise((resolve) => {
    const cleanup = () => {
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
    }
    const onMessage = (event: MessageEvent<RenditionReply>) => {
      if (event.data.id !== job.id) return
      cleanup()
      resolve(event.data)
    }
    const onError = (event: ErrorEvent) => {
      event.preventDefault()
      cleanup()
      // The script failed to load or crashed (out of memory on a huge PNG):
      // drop this worker; the caller falls back to the main thread.
      worker.terminate()
      if (slot.worker === worker) slot.worker = null
      resolve({ id: job.id, ok: false, unsupported: true, message: event.message || 'worker error' })
    }
    worker.addEventListener('message', onMessage)
    worker.addEventListener('error', onError)
    worker.postMessage(job)
  })
}

export async function generateRenditions(
  file: File,
  watermarkText?: string,
  options: { mobile?: boolean; hints?: SourceHints } = {}
): Promise<GeneratedRenditions> {
  // HEIC can arrive with an empty type (Chrome on Windows/Android).
  if (!file.type.startsWith('image/') && !looksLikeHeic(file.type, file.name)) return { variants: [] }
  const mobile = !!options.mobile
  const { hints } = options
  const slot = await acquire()
  try {
    if (!workersUnavailable) {
      const reply = await runInWorker(slot, { id: nextJobId++, file, watermarkText, mobile, hints })
      if (reply.ok) {
        return {
          variants: reply.variants as GeneratedVariant[],
          width: reply.width,
          height: reply.height,
        }
      }
      if (reply.unsupported) workersUnavailable = true
    }
    return await onMainThread(file, watermarkText, mobile, hints)
  } finally {
    release(slot)
  }
}
