'use client'
/**
 * The photographer's folder, read locally — nothing is uploaded.
 *
 *  - Chrome/Edge: File System Access API (`showDirectoryPicker`). The handle
 *    can be stored (IndexedDB) to continue after a reload and to write .xmp
 *    files next to the RAWs (after a separate «save changes» permission).
 *  - Safari/Firefox: `<input type="file" webkitdirectory>` — read-only; the
 *    results are downloaded as a ZIP of .xmp files.
 */
import { kindOf } from './raw/extract'
import type { FolderItem } from './types'

export interface FileRef {
  getFile(): Promise<File>
}

export interface Scan {
  folderName: string
  items: FolderItem[]
  files: Map<string, FileRef>
  /** Existing .xmp sidecars by relative path (lowercased base path → ref). */
  sidecars: Map<string, FileRef>
  handle: FileSystemDirectoryHandle | null
  skipped: number
}

const MAX_DEPTH = 4
const SKIP_DIRS = /^(\.|@eaDir$|__MACOSX$)/

export function hasDirectoryPicker(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

const baseKey = (dir: string, name: string) => `${dir}/${name.replace(/\.[^.]+$/, '')}`.toLowerCase()

interface RawEntry {
  path: string
  dir: string
  name: string
  size: number
  lastModified: number
  ref: FileRef
}

/** RAW+JPEG pairs become one item (the RAW); stray .xmp are collected as sidecars. */
export function buildItems(entries: RawEntry[]): Pick<Scan, 'items' | 'files' | 'sidecars' | 'skipped'> {
  const files = new Map<string, FileRef>()
  const sidecars = new Map<string, FileRef>()
  const raws = new Map<string, RawEntry>()
  const others: RawEntry[] = []
  let skipped = 0
  for (const e of entries) {
    if (e.name.toLowerCase().endsWith('.xmp')) {
      sidecars.set(baseKey(e.dir, e.name), e.ref)
      continue
    }
    const kind = kindOf(e.name)
    if (!kind) {
      skipped++
      continue
    }
    if (kind === 'raw') raws.set(baseKey(e.dir, e.name), e)
    else others.push(e)
  }
  const items: FolderItem[] = []
  const companions = new Map<string, string>()
  for (const e of others) {
    const twin = raws.get(baseKey(e.dir, e.name))
    if (twin) {
      companions.set(twin.path, e.path)
      continue
    }
    items.push({ id: e.path, name: e.name, dir: e.dir, kind: kindOf(e.name)!, size: e.size, lastModified: e.lastModified })
    files.set(e.path, e.ref)
  }
  for (const e of raws.values()) {
    items.push({
      id: e.path,
      name: e.name,
      dir: e.dir,
      kind: 'raw',
      size: e.size,
      lastModified: e.lastModified,
      ...(companions.has(e.path) ? { companion: companions.get(e.path) } : {}),
    })
    files.set(e.path, e.ref)
  }
  items.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
  return { items, files, sidecars, skipped }
}

async function walk(dir: FileSystemDirectoryHandle, prefix: string, depth: number, out: RawEntry[]) {
  // `values()` is not in every TS lib version; the runtime has it.
  const iterable = (dir as unknown as { values(): AsyncIterable<FileSystemHandle> }).values()
  for await (const entry of iterable) {
    if (entry.kind === 'directory') {
      if (depth < MAX_DEPTH && !SKIP_DIRS.test(entry.name)) {
        await walk(entry as FileSystemDirectoryHandle, `${prefix}${entry.name}/`, depth + 1, out)
      }
      continue
    }
    if (entry.name.startsWith('.')) continue
    const handle = entry as FileSystemFileHandle
    const file = await handle.getFile()
    out.push({
      path: `${prefix}${entry.name}`,
      dir: prefix.replace(/\/$/, ''),
      name: entry.name,
      size: file.size,
      lastModified: file.lastModified,
      ref: { getFile: () => handle.getFile() },
    })
  }
}

export async function scanHandle(handle: FileSystemDirectoryHandle): Promise<Scan> {
  const entries: RawEntry[] = []
  await walk(handle, '', 0, entries)
  return { folderName: handle.name, handle, ...buildItems(entries) }
}

export async function pickDirectory(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const picker = (window as unknown as { showDirectoryPicker(o?: object): Promise<FileSystemDirectoryHandle> }).showDirectoryPicker
    return await picker({ id: 'proiav-cull', mode: 'read' })
  } catch {
    return null // cancelled
  }
}

/** Files from <input webkitdirectory> (or plain multi-select). */
export function scanFileList(list: FileList | File[]): Scan {
  const entries: RawEntry[] = []
  let folderName = ''
  for (const file of Array.from(list)) {
    const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name
    const parts = rel.split('/')
    if (parts.length > 1) {
      folderName ||= parts[0]
      parts.shift() // the chosen folder itself
    }
    if (parts.some((p) => p.startsWith('.')) || parts.length - 1 > MAX_DEPTH) continue
    const path = parts.join('/')
    entries.push({
      path,
      dir: parts.slice(0, -1).join('/'),
      name: parts[parts.length - 1],
      size: file.size,
      lastModified: file.lastModified,
      ref: { getFile: async () => file },
    })
  }
  return { folderName: folderName || 'folder', handle: null, ...buildItems(entries) }
}

/** Read access for a stored handle (needs a user gesture to prompt). */
export async function ensurePermission(handle: FileSystemDirectoryHandle, mode: 'read' | 'readwrite'): Promise<boolean> {
  const h = handle as unknown as {
    queryPermission(o: object): Promise<PermissionState>
    requestPermission(o: object): Promise<PermissionState>
  }
  try {
    if ((await h.queryPermission({ mode })) === 'granted') return true
    return (await h.requestPermission({ mode })) === 'granted'
  } catch {
    return false
  }
}

/**
 * Session key: the folder's name. Items are matched by relative path + size +
 * mtime, so files added later are simply analysed on top.
 */
export function sessionIdFor(folderName: string): string {
  return `folder:${folderName}`
}
