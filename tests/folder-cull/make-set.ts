/**
 * A small "shoot folder" for e2e/benchmarks: every RAW format, a 3-frame
 * burst, a missed-focus frame next to its sharp twin, a heavily blurred frame,
 * a RAW+JPEG pair, a foreign file and an existing Lightroom .xmp.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { makeCr2, makeCr3, makeDng, makeNefOrArw, makeOrf, makeRaf, makeRw2, withExif, type RawOptions } from './make-raw'

const FIX = path.resolve(__dirname, '..', 'fixtures', 'folder-cull')
const jpg = (n: string) => new Uint8Array(readFileSync(path.join(FIX, `${n}.jpg`)))

function size(bytes: Uint8Array): [number, number] {
  for (let p = 2; p < bytes.length; ) {
    const m = bytes[p + 1]
    const len = (bytes[p + 2] << 8) | bytes[p + 3]
    if (m >= 0xc0 && m <= 0xc2) return [(bytes[p + 7] << 8) | bytes[p + 8], (bytes[p + 5] << 8) | bytes[p + 6]]
    p += 2 + len
  }
  return [0, 0]
}

const at = (h: number, m: number, s: number, sub = '00'): RawOptions => ({
  date: `2026:09:14 ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
  subSec: sub,
})

/** name → bytes. `scale` repeats the set with fresh names and times (benchmarks). */
export function testSet(scale = 1): Map<string, Uint8Array> {
  const out = new Map<string, Uint8Array>()
  const thumb = jpg('thumb')
  for (let r = 0; r < scale; r++) {
    const h = 10 + Math.floor(r / 6)
    const m = (r % 6) * 10
    const tag = scale > 1 ? `_${String(r).padStart(4, '0')}` : ''
    const big = (n: string) => jpg(n)
    // Burst of 3 (CR2), 0.2 s apart.
    out.set(`IMG_0001${tag}.CR2`, makeCr2(big('a1'), thumb, at(h, m, 0, '10'), size(big('a1'))))
    out.set(`IMG_0002${tag}.CR2`, makeCr2(big('a2'), thumb, at(h, m, 0, '30'), size(big('a2'))))
    out.set(`IMG_0003${tag}.CR2`, makeCr2(big('a3'), thumb, at(h, m, 0, '50'), size(big('a3'))))
    // Sharp + missed focus of the same scene (NEF), 1 s apart.
    out.set(`DSC_0004${tag}.NEF`, makeNefOrArw('nef', big('b1'), at(h, m, 5)))
    out.set(`DSC_0005${tag}.NEF`, makeNefOrArw('nef', big('b2'), at(h, m, 6)))
    out.set(`DSC00006${tag}.ARW`, makeNefOrArw('arw', big('c1'), at(h, m, 40)))
    out.set(`IMG_0007${tag}.DNG`, makeDng(big('d1'), at(h, m + 1, 20), size(big('d1'))))
    out.set(`P0000008${tag}.ORF`, makeOrf(big('e1'), { ...at(h, m + 2, 0), orientation: 1 }))
    out.set(`P1000009${tag}.RW2`, makeRw2(withExif(big('f1'), at(h, m + 3, 0)), at(h, m + 3, 0)))
    out.set(`DSCF0010${tag}.RAF`, makeRaf(big('g1'), at(h, m + 4, 0)))
    out.set(`IMG_0011${tag}.CR3`, makeCr3(big('h1'), big('h1'), at(h, m + 5, 0), size(big('h1'))))
    // RAW + JPEG pair: one photo.
    out.set(`IMG_0012${tag}.CR3`, makeCr3(big('i1'), big('i1'), at(h, m + 6, 0), size(big('i1'))))
    out.set(`IMG_0012${tag}.JPG`, withExif(big('i1'), at(h, m + 6, 0)))
  }
  return out
}

/** An existing Lightroom sidecar with develop settings we must not touch. */
export const EXISTING_XMP = `<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Adobe XMP Core 7.0">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:xmp="http://ns.adobe.com/xap/1.0/"
    xmlns:crs="http://ns.adobe.com/camera-raw-settings/1.0/"
   xmp:Rating="2"
   crs:Exposure2012="+0.35"
   crs:WhiteBalance="As Shot">
   <crs:ToneCurvePV2012>
    <rdf:Seq><rdf:li>0, 0</rdf:li><rdf:li>255, 255</rdf:li></rdf:Seq>
   </crs:ToneCurvePV2012>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
`

export function writeTestFolder(dir: string, scale = 1): string[] {
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const names: string[] = []
  for (const [name, bytes] of testSet(scale)) {
    writeFileSync(path.join(dir, name), bytes)
    names.push(name)
  }
  writeFileSync(path.join(dir, 'notes.txt'), 'not a photo')
  if (scale === 1) writeFileSync(path.join(dir, 'DSC_0005.xmp'), EXISTING_XMP)
  return names
}

if (require.main === module) {
  const [dir, scale] = process.argv.slice(2)
  console.log(writeTestFolder(dir, Number(scale) || 1).length, 'files')
}
