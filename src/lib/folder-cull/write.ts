'use client'
/**
 * Writing the planned sidecars: straight into the folder (File System Access,
 * after the «save changes» permission) or as a ZIP to copy over (Safari /
 * Firefox — read-only folder access).
 */
import { ensurePermission, type Scan } from './source'
import type { PlannedSidecar } from './export'

export async function readExisting(scan: Scan): Promise<{ text: Map<string, string>; names: Map<string, string> }> {
  const text = new Map<string, string>()
  const names = new Map<string, string>()
  await Promise.all(
    [...scan.sidecars.entries()].map(async ([key, ref]) => {
      try {
        const f = await ref.getFile()
        if (f.size > 4 * 1024 * 1024) return // not a sidecar we should touch
        text.set(key, await f.text())
        names.set(key, f.name)
      } catch {
        /* unreadable: treated as absent */
      }
    })
  )
  return { text, names }
}

/**
 * Existing sidecars read from the folder NOW (not from the scan): Lightroom
 * may have written develop settings into them since — we must update, never
 * overwrite. Keys like sidecarKey(): `${dir}/${base}` lowercased.
 */
export async function readExistingFromHandle(
  root: FileSystemDirectoryHandle,
  dirs: Iterable<string>
): Promise<{ text: Map<string, string>; names: Map<string, string> }> {
  const text = new Map<string, string>()
  const names = new Map<string, string>()
  for (const dir of new Set(dirs)) {
    let h: FileSystemDirectoryHandle
    try {
      h = await dirFor(root, dir)
    } catch {
      continue
    }
    const entries = (h as unknown as { entries(): AsyncIterable<[string, FileSystemHandle]> }).entries()
    for await (const [name, entry] of entries) {
      if (entry.kind !== 'file' || !name.toLowerCase().endsWith('.xmp')) continue
      const file = await (entry as FileSystemFileHandle).getFile()
      if (file.size > 4 * 1024 * 1024) continue
      const key = `${dir}/${name.replace(/\.[^.]+$/, '')}`.toLowerCase()
      text.set(key, await file.text())
      names.set(key, name)
    }
  }
  return { text, names }
}

async function dirFor(root: FileSystemDirectoryHandle, dir: string): Promise<FileSystemDirectoryHandle> {
  let h = root
  for (const part of dir.split('/').filter(Boolean)) h = await h.getDirectoryHandle(part)
  return h
}

export interface WriteResult {
  written: PlannedSidecar[]
  failed: string[]
  ms: number
}

export async function writeToFolder(handle: FileSystemDirectoryHandle, sidecars: PlannedSidecar[], concurrency = 8): Promise<WriteResult | null> {
  if (!(await ensurePermission(handle, 'readwrite'))) return null
  const t0 = performance.now()
  const written: PlannedSidecar[] = []
  const failed: string[] = []
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(concurrency, sidecars.length) }, async () => {
      while (next < sidecars.length) {
        const s = sidecars[next++]
        try {
          const dir = await dirFor(handle, s.item.dir)
          const fh = await dir.getFileHandle(s.fileName, { create: true })
          const w = await fh.createWritable()
          await w.write(s.xml)
          await w.close()
          written.push(s)
        } catch {
          failed.push(s.path)
        }
      }
    })
  )
  return { written, failed, ms: performance.now() - t0 }
}

export async function buildZip(folderName: string, sidecars: PlannedSidecar[], extra: { name: string; text: string }[]): Promise<Blob> {
  const { BlobWriter, TextReader, ZipWriter } = await import('@zip.js/zip.js')
  const zip = new ZipWriter(new BlobWriter('application/zip'))
  for (const s of sidecars) await zip.add(`${folderName}/${s.path}`, new TextReader(s.xml))
  for (const e of extra) await zip.add(e.name, new TextReader(e.text))
  return zip.close()
}

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
