/**
 * Zip import planning, shared by the browser (which reads the zip) and the
 * server (which validates what the browser sends). Pure functions, no I/O.
 */

/**
 * One zip per import. Nothing is held in memory (entries are read one by one
 * straight from the File), so the real limits are time with the tab open and
 * the plan's storage — 10 GB is an hour-ish at typical Ukrainian upload speeds.
 */
export const MAX_ZIP_BYTES = 10 * 1024 * 1024 * 1024

/** Upper bounds the start endpoint enforces — well above any real gallery. */
export const MAX_IMPORT_FILES = 20_000
export const MAX_IMPORT_GROUPS = 200
export const MAX_TITLE_LENGTH = 200

/**
 * Zip entries carry no MIME type, so it comes from the extension. Only types
 * the regular uploader also ends up with (browsers report image/* / video/*
 * for these); RAW files and documents are skipped and counted.
 */
const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  heic: 'image/heic',
  heif: 'image/heif',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  mp4: 'video/mp4',
  m4v: 'video/x-m4v',
  mov: 'video/quicktime',
  webm: 'video/webm',
}

export function mimeFromName(name: string): string | null {
  const dot = name.lastIndexOf('.')
  if (dot < 0) return null
  return MIME_BY_EXTENSION[name.slice(dot + 1).toLowerCase()] ?? null
}

/** macOS/Windows metadata that zips drag along — never counted as a file. */
export function isJunkPath(path: string): boolean {
  const parts = path.split('/')
  const base = parts[parts.length - 1]
  return (
    parts.some((part) => part === '__MACOSX') ||
    base.startsWith('._') ||
    base === '.DS_Store' ||
    base === 'Thumbs.db' ||
    base === 'desktop.ini'
  )
}

/** "Весілля Анни (1).zip" → "Весілля Анни (1)". */
export function zipBaseName(zipFileName: string): string {
  const trimmed = zipFileName.replace(/\.zip$/i, '').trim()
  return trimmed || 'Imported gallery'
}

export interface PlannedFile {
  /** Full path inside the zip — how the browser finds the entry again. */
  path: string
  /** File name without folders — stored as assets.original_name. */
  name: string
  size: number
  contentType: string
}

export interface PlannedGallery {
  title: string
  files: PlannedFile[]
}

export interface ZipPlan {
  galleries: PlannedGallery[]
  filesTotal: number
  /** Entries that are not photos/videos (documents, RAW, …). */
  skippedUnsupported: number
  /** Same file name twice inside one folder of the zip. */
  skippedDuplicateInZip: number
}

/**
 * Group zip entries into galleries: files in the zip root go to «Назва zip»,
 * every folder becomes «Назва zip — Папка» (nested folders keep their path:
 * «Назва — Папка / Підпапка»). A single wrapper folder around everything
 * (common in exported zips) is not a gallery of its own and is dropped.
 */
export function planZip(
  zipFileName: string,
  entries: { path: string; size: number; directory: boolean }[]
): ZipPlan {
  const files = entries.filter((entry) => !entry.directory && !isJunkPath(entry.path))

  const dirOf = (path: string) => {
    const slash = path.lastIndexOf('/')
    return slash < 0 ? '' : path.slice(0, slash)
  }

  // Strip one shared top-level folder, if every file sits inside it.
  let wrapper = ''
  const firstSegments = new Set(files.map((file) => file.path.split('/')[0]))
  if (
    files.length > 0 &&
    firstSegments.size === 1 &&
    files.every((file) => file.path.includes('/'))
  ) {
    wrapper = `${[...firstSegments][0]}/`
  }

  const base = zipBaseName(zipFileName)
  const byTitle = new Map<string, PlannedGallery>()
  const seen = new Set<string>()
  let skippedUnsupported = 0
  let skippedDuplicateInZip = 0

  for (const entry of files) {
    const relative = entry.path.slice(wrapper.length)
    const name = relative.slice(relative.lastIndexOf('/') + 1)
    const contentType = mimeFromName(name)
    if (!contentType || entry.size <= 0) {
      skippedUnsupported++
      continue
    }

    // Trimmed on every side: the server trims titles, and a title that differs
    // by a trailing space («Day 1 ») would no longer match its gallery, so all
    // of its files would be silently dropped.
    const folder = dirOf(relative)
      .split('/')
      .map((segment) => segment.trim())
      .filter(Boolean)
      .join(' / ')
    const title = (folder ? `${base} — ${folder}` : base).slice(0, MAX_TITLE_LENGTH).trim()

    const dedupeKey = `${title}\u0000${name}`
    if (seen.has(dedupeKey)) {
      skippedDuplicateInZip++
      continue
    }
    seen.add(dedupeKey)

    let gallery = byTitle.get(title)
    if (!gallery) {
      gallery = { title, files: [] }
      byTitle.set(title, gallery)
    }
    gallery.files.push({ path: entry.path, name, size: entry.size, contentType })
  }

  const galleries = [...byTitle.values()].sort((a, b) => a.title.localeCompare(b.title))
  for (const gallery of galleries) {
    gallery.files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  }

  return {
    galleries,
    filesTotal: files.length,
    skippedUnsupported,
    skippedDuplicateInZip,
  }
}
