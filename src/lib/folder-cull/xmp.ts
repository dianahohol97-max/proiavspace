/**
 * XMP sidecars for Lightroom Classic / Capture One / Bridge.
 *
 * What is written (see docs/FOLDER_CULLING.md for the sources):
 *   xmp:Rating      -1 = Rejected (XMP spec; Bridge), 0–5 = stars
 *   xmp:Label       colour label by its English name (Lightroom default set)
 *   xmpDM:pick      1 / -1 — Lightroom Classic 13.2+ pick / reject flag
 *   xmpDM:good      True / False — the same flag in its older form
 *   xmp:MetadataDate so Lightroom notices the file changed
 *
 * An existing sidecar is never rewritten wholesale: only these attributes /
 * elements are touched, in place; everything else (develop settings,
 * keywords, other apps' data) stays byte-for-byte the same.
 */

export const NS = {
  x: 'adobe:ns:meta/',
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  xmp: 'http://ns.adobe.com/xap/1.0/',
  xmpDM: 'http://ns.adobe.com/xmp/1.0/DynamicMedia/',
} as const

type Prefix = 'xmp' | 'xmpDM'

/** undefined = leave alone; null = remove; string = set. */
export type FieldValue = string | null | undefined

export interface XmpFields {
  rating?: FieldValue
  label?: FieldValue
  pick?: FieldValue
  good?: FieldValue
}

const FIELD_DEFS: Record<keyof XmpFields, { prefix: Prefix; name: string }> = {
  rating: { prefix: 'xmp', name: 'Rating' },
  label: { prefix: 'xmp', name: 'Label' },
  pick: { prefix: 'xmpDM', name: 'pick' },
  good: { prefix: 'xmpDM', name: 'good' },
}

export function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
function unescapeXml(s: string): string {
  return s.replace(/&quot;/g, '"').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
}
const re = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function newSidecar(fields: XmpFields, now = new Date()): string {
  const attrs: string[] = []
  for (const key of Object.keys(FIELD_DEFS) as (keyof XmpFields)[]) {
    const v = fields[key]
    if (typeof v === 'string') attrs.push(`   ${FIELD_DEFS[key].prefix}:${FIELD_DEFS[key].name}="${escapeXml(v)}"`)
  }
  attrs.push(`   xmp:MetadataDate="${isoWithOffset(now)}"`)
  return `<x:xmpmeta xmlns:x="${NS.x}" x:xmptk="proiav culling">
 <rdf:RDF xmlns:rdf="${NS.rdf}">
  <rdf:Description rdf:about=""
    xmlns:xmp="${NS.xmp}"
    xmlns:xmpDM="${NS.xmpDM}"
${attrs.join('\n')}/>
 </rdf:RDF>
</x:xmpmeta>
`
}

/** "2026-11-07T14:03:22+02:00" (XMP date with the local offset). */
export function isoWithOffset(d: Date): string {
  const pad = (n: number) => String(Math.abs(n)).padStart(2, '0')
  const off = -d.getTimezoneOffset()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${off >= 0 ? '+' : '-'}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`
}

interface Located {
  /** Start tag of the rdf:Description that will receive new attributes. */
  start: number
  end: number
  tag: string
  /** Prefix bound to each namespace we use (may differ from ours, e.g. "xap"). */
  prefixes: Record<Prefix, string | null>
}

function locate(xml: string): Located | null {
  const m = /<rdf:Description\b[^>]*?\/?>/.exec(xml)
  if (!m) return null
  const prefixFor = (uri: string): string | null => {
    const d = new RegExp(`xmlns:([\\w.-]+)\\s*=\\s*["']${re(uri)}["']`).exec(xml)
    return d ? d[1] : null
  }
  return { start: m.index, end: m.index + m[0].length, tag: m[0], prefixes: { xmp: prefixFor(NS.xmp), xmpDM: prefixFor(NS.xmpDM) } }
}

/** Current values of our fields in an existing sidecar (attribute or element form). */
export function readFields(xml: string): Record<keyof XmpFields, string | null> {
  const out = { rating: null, label: null, pick: null, good: null } as Record<keyof XmpFields, string | null>
  const loc = locate(xml)
  if (!loc) return out
  for (const key of Object.keys(FIELD_DEFS) as (keyof XmpFields)[]) {
    const p = loc.prefixes[FIELD_DEFS[key].prefix]
    if (!p) continue
    const q = `${re(p)}:${FIELD_DEFS[key].name}`
    const attr = new RegExp(`\\s${q}\\s*=\\s*(["'])(.*?)\\1`).exec(xml)
    const el = new RegExp(`<${q}>([^<]*)</${q}>`).exec(xml)
    const v = attr ? attr[2] : el ? el[1] : null
    out[key] = v === null ? null : unescapeXml(v)
  }
  return out
}

/**
 * Updates only our fields in an existing sidecar. Returns null if it does not
 * look like XMP (the caller then leaves the file alone and reports it).
 */
export function updateSidecar(xml: string, fields: XmpFields, now = new Date()): string | null {
  let out = xml
  let loc = locate(out)
  if (!loc) return null
  const all: [Prefix, string, FieldValue][] = (Object.keys(FIELD_DEFS) as (keyof XmpFields)[]).map((k) => [
    FIELD_DEFS[k].prefix,
    FIELD_DEFS[k].name,
    fields[k],
  ])
  all.push(['xmp', 'MetadataDate', isoWithOffset(now)])

  for (const [prefix, name, value] of all) {
    if (value === undefined) continue
    loc = locate(out)!
    const bound = loc.prefixes[prefix]
    const p = bound ?? prefix
    const q = `${re(p)}:${name}`
    const attr = new RegExp(`(\\s)${q}\\s*=\\s*(["'])(.*?)\\2`)
    const el = new RegExp(`\\s*<${q}>[^<]*</${q}>`)
    if (attr.test(out)) {
      out = value === null ? out.replace(attr, '') : out.replace(attr, (_m, sp, quote) => `${sp}${p}:${name}=${quote}${escapeXml(value)}${quote}`)
      continue
    }
    if (el.test(out)) {
      out = value === null ? out.replace(el, '') : out.replace(new RegExp(`(<${q}>)[^<]*(</${q}>)`), `$1${escapeXml(value)}$2`)
      continue
    }
    if (value === null) continue
    // New attribute on the first rdf:Description (+ namespace declaration if missing).
    const decl = bound ? '' : ` xmlns:${prefix}="${NS[prefix]}"`
    const closing = loc.tag.endsWith('/>') ? '/>' : '>'
    const head = loc.tag.slice(0, loc.tag.length - closing.length).replace(/\s+$/, '')
    const tag = `${head}${decl}\n   ${p}:${name}="${escapeXml(value)}"${closing}`
    out = out.slice(0, loc.start) + tag + out.slice(loc.end)
  }
  return out
}
