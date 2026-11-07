import { BlobWriter, ZipWriter, configure } from '@zip.js/zip.js'

/**
 * «Завантажити все»: the browser fetches originals straight from storage and
 * packs them into a zip itself — no server egress.
 *
 * zip.js instead of fflate because a wedding gallery is 10–30 GB and fflate
 * cannot write ZIP64: past 4 GB the offsets overflow and the archive is
 * corrupt (CL-01). Entries are stored (level 0) — JPEGs and videos do not
 * compress, and storing keeps the CPU idle.
 */

// Stored entries need no codec, so no worker either (no worker URL/CSP setup).
configure({ useWebWorkers: false })

export interface ArchiveFile {
  name: string
  url: string
  /** Original size in bytes — used to cut the archive into parts. */
  size?: number
}

type Fetcher = (url: string) => Promise<Response>

async function addFile(zip: ZipWriter<unknown>, file: ArchiveFile, fetcher: Fetcher): Promise<void> {
  const response = await fetcher(file.url)
  if (!response.ok || !response.body) throw new Error(`fetch ${file.name}`)
  await zip.add(file.name, response.body, { level: 0 })
}

/** One zip streamed into a writable (Chromium's save-file stream): nothing is held in memory. */
export async function writeZipToStream(
  files: ArchiveFile[],
  writable: WritableStream<Uint8Array>,
  onFileDone: () => void,
  fetcher: Fetcher = (url) => fetch(url)
): Promise<void> {
  const zip = new ZipWriter(writable, { level: 0, zip64: true, bufferedWrite: false, keepOrder: true })
  for (const file of files) {
    await addFile(zip, file, fetcher)
    onFileDone()
  }
  await zip.close()
}

/**
 * Safari, Firefox and every phone have no save-file stream, so a zip has to
 * live in memory until it is handed over. To keep that bounded (CL-02) the
 * gallery is cut into parts of about `partBytes` each; only one part is in
 * memory at a time. A single file larger than a part gets a part of its own.
 */
export function splitIntoParts(files: ArchiveFile[], partBytes: number): ArchiveFile[][] {
  const parts: ArchiveFile[][] = []
  let current: ArchiveFile[] = []
  let currentBytes = 0
  for (const file of files) {
    const size = file.size ?? 0
    if (current.length > 0 && currentBytes + size > partBytes) {
      parts.push(current)
      current = []
      currentBytes = 0
    }
    current.push(file)
    currentBytes += size
  }
  if (current.length > 0) parts.push(current)
  return parts
}

/** One part as a Blob — the caller hands it to the user and lets it go. */
export async function buildZipBlob(
  files: ArchiveFile[],
  onFileDone: () => void,
  fetcher: Fetcher = (url) => fetch(url)
): Promise<Blob> {
  const zip = new ZipWriter(new BlobWriter('application/zip'), { level: 0, zip64: true, bufferedWrite: false })
  for (const file of files) {
    await addFile(zip, file, fetcher)
    onFileDone()
  }
  return zip.close()
}
