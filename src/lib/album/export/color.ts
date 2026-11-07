/**
 * sRGB → Adobe RGB (1998) pixel conversion. The browser composes the spread in
 * sRGB (canvas default); when the profile asks for Adobe RGB we convert the
 * numbers too, so the embedded Adobe RGB ICC tag describes them correctly
 * (tagging sRGB pixels as Adobe RGB would print oversaturated). Gamut is that
 * of sRGB — the browser has already mapped wider originals into it.
 */

// Linear sRGB → XYZ (D65) and XYZ (D65) → linear Adobe RGB, combined.
// M = inv(AdobeRGB→XYZ) · (sRGB→XYZ)
const M = [
  [0.715163, 0.284837, 0.0],
  [0.0, 1.0, 0.0],
  [0.0, 0.04117, 0.95883],
]

const ADOBE_GAMMA = 563 / 256
const ENC_STEPS = 4096

let decodeLut: Float32Array | null = null
let encodeLut: Uint8Array | null = null

function luts() {
  if (!decodeLut || !encodeLut) {
    decodeLut = new Float32Array(256)
    for (let i = 0; i < 256; i++) {
      const v = i / 255
      decodeLut[i] = v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    }
    encodeLut = new Uint8Array(ENC_STEPS + 1)
    for (let i = 0; i <= ENC_STEPS; i++) encodeLut[i] = Math.round((i / ENC_STEPS) ** (1 / ADOBE_GAMMA) * 255)
  }
  return { dec: decodeLut, enc: encodeLut }
}

/** In place on RGBA bytes (alpha untouched). */
export function srgbToAdobeRgbInPlace(data: Uint8ClampedArray | Uint8Array): void {
  const { dec, enc } = luts()
  const [m0, m1, m2] = M as [number[], number[], number[]]
  for (let i = 0; i < data.length; i += 4) {
    const r = dec[data[i]!]!
    const g = dec[data[i + 1]!]!
    const b = dec[data[i + 2]!]!
    const R = m0[0]! * r + m0[1]! * g + m0[2]! * b
    const G = m1[0]! * r + m1[1]! * g + m1[2]! * b
    const B = m2[0]! * r + m2[1]! * g + m2[2]! * b
    data[i] = enc[Math.round(Math.min(Math.max(R, 0), 1) * ENC_STEPS)]!
    data[i + 1] = enc[Math.round(Math.min(Math.max(G, 0), 1) * ENC_STEPS)]!
    data[i + 2] = enc[Math.round(Math.min(Math.max(B, 0), 1) * ENC_STEPS)]!
  }
}
