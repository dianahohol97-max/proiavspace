// Bundled by tests/e2e/archive.spec.ts and injected into the browser page.
import { BlobReader, Uint8ArrayWriter, ZipReader } from '@zip.js/zip.js'
import { buildZipBlob, splitIntoParts, writeZipToStream } from '@/lib/gallery/archive'

declare global {
  interface Window {
    __archive: typeof api
  }
}

const api = {
  buildZipBlob,
  splitIntoParts,
  writeZipToStream,
  /** Reads a zip back: name → bytes. */
  async unzip(blob: Blob): Promise<Record<string, Uint8Array>> {
    const reader = new ZipReader(new BlobReader(blob))
    const out: Record<string, Uint8Array> = {}
    for (const entry of await reader.getEntries()) {
      if (!entry.directory) out[entry.filename] = await entry.getData!(new Uint8ArrayWriter())
    }
    await reader.close()
    return out
  },
}

window.__archive = api
