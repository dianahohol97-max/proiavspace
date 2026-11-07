/**
 * Random access to a file WITHOUT reading it whole: `File.slice()` fetches only
 * the requested byte range. Reads are aligned to blocks and cached, because
 * the RAW parsers jump around (IFD → EXIF IFD → maker note → preview header).
 * The preview JPEG itself is read once, in one range.
 */
export interface RangeReader {
  readonly size: number
  read(offset: number, length: number): Promise<Uint8Array>
  /** Bytes actually pulled from the underlying source (for benchmarks). */
  readonly bytesRead: number
}

const BLOCK = 64 * 1024

abstract class CachedReader implements RangeReader {
  private cache = new Map<number, Uint8Array>()
  bytesRead = 0
  constructor(readonly size: number) {}
  protected abstract fetch(offset: number, length: number): Promise<Uint8Array>

  private async block(index: number): Promise<Uint8Array> {
    let b = this.cache.get(index)
    if (!b) {
      const start = index * BLOCK
      b = await this.fetch(start, Math.min(BLOCK, this.size - start))
      this.bytesRead += b.length
      if (this.cache.size > 64) this.cache.clear()
      this.cache.set(index, b)
    }
    return b
  }

  async read(offset: number, length: number): Promise<Uint8Array> {
    if (offset < 0 || length < 0 || offset + length > this.size) throw new RangeError(`read ${offset}+${length} > ${this.size}`)
    if (length === 0) return new Uint8Array(0)
    // Big reads (the preview JPEG) go straight through, uncached.
    if (length > BLOCK * 2) {
      const data = await this.fetch(offset, length)
      this.bytesRead += data.length
      return data
    }
    const first = Math.floor(offset / BLOCK)
    const last = Math.floor((offset + length - 1) / BLOCK)
    if (first === last) {
      const b = await this.block(first)
      const at = offset - first * BLOCK
      return b.subarray(at, at + length)
    }
    const out = new Uint8Array(length)
    let written = 0
    for (let i = first; i <= last; i++) {
      const b = await this.block(i)
      const from = i === first ? offset - first * BLOCK : 0
      const to = Math.min(b.length, offset + length - i * BLOCK)
      out.set(b.subarray(from, to), written)
      written += to - from
    }
    return out
  }
}

export class BlobReader extends CachedReader {
  constructor(private blob: Blob) {
    super(blob.size)
  }
  protected async fetch(offset: number, length: number) {
    return new Uint8Array(await this.blob.slice(offset, offset + length).arrayBuffer())
  }
}

/** For tests and node scripts. */
export class BytesReader extends CachedReader {
  constructor(private bytes: Uint8Array) {
    super(bytes.length)
  }
  protected async fetch(offset: number, length: number) {
    return this.bytes.slice(offset, offset + length)
  }
}

/** Endian-aware number reading over a byte array. */
export class View {
  private dv: DataView
  constructor(
    readonly bytes: Uint8Array,
    public little: boolean
  ) {
    this.dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  }
  u8(o: number) {
    return this.dv.getUint8(o)
  }
  u16(o: number) {
    return this.dv.getUint16(o, this.little)
  }
  u32(o: number) {
    return this.dv.getUint32(o, this.little)
  }
  ascii(o: number, n: number) {
    let s = ''
    for (let i = 0; i < n && o + i < this.bytes.length; i++) {
      const c = this.bytes[o + i]
      if (c === 0) break
      s += String.fromCharCode(c)
    }
    return s
  }
}

export function asciiAt(bytes: Uint8Array, offset: number, length: number): string {
  return new View(bytes, true).ascii(offset, length)
}
