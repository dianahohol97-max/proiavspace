'use client'

/**
 * Export orchestration in the browser: JPEG per spread (ZIP when several),
 * PDF of the whole album, PSD of a spread. Spreads are rendered strictly one
 * after another; fresh signed URLs for originals are requested per spread so
 * long exports never hit an expired link.
 */
import { slugifyUk } from '@/lib/seo/translit'
import { formatFor } from '../geometry'
import type { AlbumPhoto, AlbumProject, AlbumSpread } from '../types'
import { iccProfile } from './icc'
import { buildAlbumPdf, type PdfPage } from './pdf'
import { ExportError, convertCanvasColor, encodeSpreadJpeg, releaseCanvas, renderSpread } from './render'

export type ExportKind = 'jpeg' | 'pdf' | 'psd'

export interface ExportProgress {
  /** 0..1 */
  fraction: number
  label: string
}

/** Signed GET URLs of originals (server: short-lived R2 links; demo: the preview files). */
export type OriginalUrlSource = (assetIds: string[]) => Promise<Record<string, string>>

export interface ExportRequest {
  project: AlbumProject
  photos: AlbumPhoto[]
  kind: ExportKind
  /** Which spreads, in album order. */
  spreadIds: string[]
  cropMarks: boolean
  originalUrls: OriginalUrlSource
  onProgress: (p: ExportProgress) => void
  signal?: AbortSignal
}

export interface ExportResult {
  blob: Blob
  fileName: string
}

export function spreadLabel(spread: AlbumSpread, index: number, spreads: AlbumSpread[]): string {
  if (spread.kind === 'cover') return 'Обкладинка'
  const coverCount = spreads.slice(0, index).filter((s) => s.kind === 'cover').length
  return `Розворот ${index + 1 - coverCount}`
}

function fileStem(project: AlbumProject): string {
  return slugifyUk(project.title, 60) || 'album'
}

function spreadFileName(project: AlbumProject, spread: AlbumSpread, index: number, spreads: AlbumSpread[], ext: string): string {
  const n = String(index + 1).padStart(2, '0')
  const what = spread.kind === 'cover' ? 'oblozhka' : slugifyUk(spreadLabel(spread, index, spreads))
  return `${fileStem(project)}-${n}-${what}.${ext}`
}

async function fetchOriginal(url: string, signal?: AbortSignal): Promise<Blob> {
  const response = await fetch(url, { signal, cache: 'no-store' })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.blob()
}

export async function runExport(request: ExportRequest): Promise<ExportResult> {
  const { project, photos, kind, signal, onProgress } = request
  const photosById = new Map(photos.map((p) => [p.id, p]))
  const all = project.spreads
  const chosen = request.spreadIds
    .map((id) => ({ spread: all.find((s) => s.id === id)!, index: all.findIndex((s) => s.id === id) }))
    .filter((x) => x.spread)
  if (!chosen.length) throw new ExportError('encode_failed', 'Не вибрано жодного розвороту')

  // Weighted steps: every photo is one unit, every encode two.
  const units = chosen.reduce((n, { spread }) => n + spread.slots.filter((s) => s.assetId).length + 2, 0) + 1
  let done = 0
  const report = (label: string, add = 0) => {
    done += add
    onProgress({ fraction: Math.min(done / units, 0.999), label })
  }

  const outputs: { name: string; blob: Blob; page?: PdfPage }[] = []
  for (let k = 0; k < chosen.length; k++) {
    const { spread, index } = chosen[k]!
    const label = `${spreadLabel(spread, index, all)} (${k + 1}/${chosen.length})`
    if (signal?.aborted) throw new ExportError('aborted', 'Експорт скасовано')
    const ids = [...new Set(spread.slots.map((s) => s.assetId).filter((id): id is string => !!id && photosById.has(id)))]
    report(`${label}: посилання на оригінали…`)
    const urls = ids.length ? await request.originalUrls(ids) : {}
    let lastPhoto = -1
    const rendered = await renderSpread(
      spread,
      project.spec,
      photosById,
      (assetId) => {
        const url = urls[assetId]
        if (!url) return Promise.reject(new Error('немає посилання'))
        return fetchOriginal(url, signal)
      },
      {
        layers: kind === 'psd',
        signal,
        onPhoto: (i, total) => {
          report(`${label}: фото ${i + 1} з ${total}`, lastPhoto >= 0 ? 1 : 0)
          lastPhoto = i
        },
      }
    )
    if (lastPhoto >= 0) report(label, 1)
    try {
      if (kind === 'psd') {
        report(`${label}: збираю PSD (шари)…`)
        await convertCanvasColor(rendered.canvas, project.spec)
        const composite = rendered.canvas.getContext('2d')!.getImageData(0, 0, rendered.width, rendered.height).data
        releaseCanvas(rendered.canvas)
        const { buildSpreadPsd } = await import('./psd')
        const bytes = buildSpreadPsd({
          width: rendered.width,
          height: rendered.height,
          dpi: project.spec.dpi,
          icc: iccProfile(project.spec.colorProfile),
          composite,
          background: [255, 255, 255],
          layers: rendered.layers ?? [],
        })
        outputs.push({ name: spreadFileName(project, spread, index, all, 'psd'), blob: new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'image/vnd.adobe.photoshop' }) })
      } else {
        report(`${label}: кодую JPEG…`)
        const jpeg = await encodeSpreadJpeg(rendered.canvas, project.spec)
        const format = formatFor(project.spec, spread.kind)
        outputs.push({
          name: spreadFileName(project, spread, index, all, 'jpg'),
          blob: jpeg,
          page: {
            jpeg,
            widthPx: rendered.width,
            heightPx: rendered.height,
            trimWidthMm: format.widthMm,
            trimHeightMm: format.heightMm,
            bleedMm: format.bleedMm,
          },
        })
      }
    } finally {
      releaseCanvas(rendered.canvas)
    }
    report(label, 2)
  }

  let result: ExportResult
  if (kind === 'pdf') {
    report('Збираю PDF…')
    const blob = await buildAlbumPdf(
      outputs.map((o) => o.page!),
      { title: project.title, cropMarks: request.cropMarks, icc: iccProfile(project.spec.colorProfile) }
    )
    result = { blob, fileName: `${fileStem(project)}.pdf` }
  } else if (outputs.length === 1) {
    result = { blob: outputs[0]!.blob, fileName: outputs[0]!.name }
  } else {
    report('Пакую ZIP…')
    const { BlobReader, BlobWriter, ZipWriter, configure } = await import('@zip.js/zip.js')
    configure({ useWebWorkers: false })
    const zip = new ZipWriter(new BlobWriter('application/zip'), { level: 0, zip64: true, bufferedWrite: false })
    for (const o of outputs) await zip.add(o.name, new BlobReader(o.blob), { level: 0 })
    result = { blob: await zip.close(), fileName: `${fileStem(project)}-${kind}.zip` }
  }
  onProgress({ fraction: 1, label: 'Готово' })
  return result
}

export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
