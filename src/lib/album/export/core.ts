/**
 * Export core — no DOM, no React: runs inside the export Web Worker
 * (worker.ts) and, as a fallback, on the main thread. JPEG per spread (ZIP
 * when several), PDF of the album (photos as JPEG + live text with embedded
 * fonts), PSD of a spread (a layer per photo and per text). Spreads are
 * rendered strictly one after another; fresh signed URLs for originals are
 * requested per spread, so a long export never hits an expired link.
 */
import { slugifyUk } from '@/lib/seo/translit'
import { ALBUM_FONTS, fontById, loadAlbumFonts } from '../fonts'
import { formatFor } from '../geometry'
import { baselineOffsets, hexToRgb, ptToMm, textLines } from '../texts'
import type { AlbumPhoto, AlbumProject, AlbumSpread } from '../types'
import { fetchOriginal } from './fetch-original'
import { iccProfile } from './icc'
import { buildAlbumPdf, type PdfPage, type PdfText } from './pdf'
import { FontSubsetter, fontkitCreate } from './pdf-fonts'
import { ExportError, convertCanvasColor, encodeSpreadJpeg, releaseCanvas, renderSpread } from './render'

export type ExportKind = 'jpeg' | 'pdf' | 'psd'

export interface ExportProgress {
  /** 0..1 */
  fraction: number
  label: string
}

/** What the worker needs (structured-clone friendly). */
export interface CoreRequest {
  project: AlbumProject
  photos: AlbumPhoto[]
  kind: ExportKind
  spreadIds: string[]
  cropMarks: boolean
}

export interface CoreDeps {
  /** Signed GET URLs of originals (server: short-lived B2 links; demo: the bundled files). */
  getUrls(assetIds: string[]): Promise<Record<string, string>>
  onProgress(p: ExportProgress): void
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

/** Font ids used by these spreads. */
export function usedFonts(spreads: AlbumSpread[]): string[] {
  const ids = new Set<string>()
  for (const s of spreads) for (const t of s.texts ?? []) if (t.text.trim()) ids.add(fontById(t.font).id)
  return [...ids]
}

export async function exportCore(request: CoreRequest, deps: CoreDeps): Promise<ExportResult> {
  const { project, photos, kind } = request
  const { signal, onProgress } = deps
  const photosById = new Map(photos.map((p) => [p.id, p]))
  const all = project.spreads
  const chosen = request.spreadIds
    .map((id) => ({ spread: all.find((s) => s.id === id)!, index: all.findIndex((s) => s.id === id) }))
    .filter((x) => x.spread)
  if (!chosen.length) throw new ExportError('encode_failed', 'Не вибрано жодного розвороту')

  const units = chosen.reduce((n, { spread }) => n + spread.slots.filter((s) => s.assetId).length + 2, 0) + 2
  let done = 0
  const report = (label: string, add = 0) => {
    done += add
    onProgress({ fraction: Math.min(done / units, 0.999), label })
  }

  // Fonts: the canvas needs them registered (JPEG/PSD raster), the PDF needs the files.
  const fontIds = usedFonts(chosen.map((c) => c.spread))
  if (fontIds.length) {
    report('Шрифти…')
    try {
      await loadAlbumFonts(fontIds)
    } catch (cause) {
      throw new ExportError('fonts_failed', `Не вдалося завантажити шрифти для тексту: ${(cause as Error).message}`)
    }
  }
  const subsetters = new Map<string, FontSubsetter>()
  if (kind === 'pdf' && fontIds.length) {
    const create = await fontkitCreate()
    for (const id of fontIds) {
      const font = fontById(id)
      const bytes = new Uint8Array(await (await fetch(font.file, { signal })).arrayBuffer())
      subsetters.set(id, new FontSubsetter(create(bytes), font.kind, bytes))
    }
  }
  report('', 1)

  const outputs: { name: string; blob: Blob; page?: PdfPage }[] = []
  for (let k = 0; k < chosen.length; k++) {
    const { spread, index } = chosen[k]!
    const label = `${spreadLabel(spread, index, all)} (${k + 1}/${chosen.length})`
    if (signal?.aborted) throw new ExportError('aborted', 'Експорт скасовано')
    const ids = [...new Set(spread.slots.map((s) => s.assetId).filter((id): id is string => !!id && photosById.has(id)))]
    report(`${label}: посилання на оригінали…`)
    const urls = ids.length ? await deps.getUrls(ids) : {}
    let lastPhoto = -1
    const rendered = await renderSpread(
      spread,
      project.spec,
      photosById,
      (assetId) => {
        const url = urls[assetId]
        const name = photosById.get(assetId)?.name ?? assetId
        if (!url) return Promise.reject(new ExportError('original_failed', `Немає посилання на оригінал «${name}»`))
        return fetchOriginal(url, name, signal)
      },
      {
        layers: kind === 'psd',
        rasterText: kind !== 'pdf',
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
        const ctx = rendered.canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D
        const composite = ctx.getImageData(0, 0, rendered.width, rendered.height).data
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
        const format = formatFor(project.spec, spread)
        const texts: PdfText[] = []
        if (kind === 'pdf') {
          for (const t of spread.texts ?? []) {
            if (!t.text.trim()) continue
            const font = fontById(t.font)
            const subsetter = subsetters.get(font.id)
            if (!subsetter) continue
            const offsets = baselineOffsets(t)
            texts.push({
              fontKey: font.id,
              sizePt: t.sizePt,
              rgb: hexToRgb(t.color),
              x: t.x,
              y: t.y,
              rotation: t.rotation,
              align: t.align,
              lineStepMm: offsets[1] ?? ptToMm(t.sizePt) * (t.lineHeight || 1.25),
              lines: textLines(t.text).map((line) => subsetter.shape(line)),
            })
          }
        }
        outputs.push({
          name: spreadFileName(project, spread, index, all, 'jpg'),
          blob: jpeg,
          page: { jpeg, widthPx: rendered.width, heightPx: rendered.height, trimWidthMm: format.widthMm, trimHeightMm: format.heightMm, bleedMm: format.bleedMm, texts },
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
    const fonts = []
    for (const [key, subsetter] of subsetters) fonts.push({ key, data: await subsetter.finish() })
    const blob = await buildAlbumPdf(
      outputs.map((o) => o.page!),
      { title: project.title, cropMarks: request.cropMarks, icc: iccProfile(project.spec.colorProfile), fonts }
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

/** Every font file the album can use (for preloading). */
export const ALL_FONT_IDS = ALBUM_FONTS.map((f) => f.id)
