/**
 * PSD of one spread with a separate layer per photo (ag-psd, MIT). Layers are
 * pixel data in their slot position; the bottom layer is the background, the
 * composite is the flattened spread. Resolution and ICC go into the image
 * resources, so Photoshop opens it at the profile's print size.
 */
import { writePsdUint8Array, type Layer, type Psd } from 'ag-psd'

export interface PsdLayerInput {
  name: string
  left: number
  top: number
  width: number
  height: number
  data: Uint8ClampedArray
}

export interface PsdInput {
  width: number
  height: number
  dpi: number
  icc: Uint8Array
  /** Flattened spread (RGBA). */
  composite: Uint8ClampedArray
  /** Plain background colour layer under the photos. */
  background: [number, number, number]
  layers: PsdLayerInput[]
}

export function buildSpreadPsd(input: PsdInput): Uint8Array {
  const bg = new Uint8ClampedArray(input.width * input.height * 4)
  const [r, g, b] = input.background
  for (let i = 0; i < bg.length; i += 4) {
    bg[i] = r
    bg[i + 1] = g
    bg[i + 2] = b
    bg[i + 3] = 255
  }
  const children: Layer[] = [
    {
      name: 'Фон',
      left: 0,
      top: 0,
      right: input.width,
      bottom: input.height,
      imageData: { data: bg, width: input.width, height: input.height },
    },
    ...input.layers.map<Layer>((layer) => ({
      name: layer.name,
      left: layer.left,
      top: layer.top,
      right: layer.left + layer.width,
      bottom: layer.top + layer.height,
      imageData: { data: layer.data, width: layer.width, height: layer.height },
    })),
  ]
  const psd: Psd = {
    width: input.width,
    height: input.height,
    channels: 3,
    bitsPerChannel: 8,
    colorMode: 3, // RGB
    imageData: { data: input.composite, width: input.width, height: input.height },
    children,
    imageResources: {
      resolutionInfo: {
        horizontalResolution: input.dpi,
        horizontalResolutionUnit: 'PPI',
        widthUnit: 'Centimeters',
        verticalResolution: input.dpi,
        verticalResolutionUnit: 'PPI',
        heightUnit: 'Centimeters',
      },
      iccProfile: input.icc,
    },
  }
  // PSB beyond 30 000 px (PSD limit); album spreads at 300 DPI stay well under.
  const psb = input.width > 30000 || input.height > 30000
  return writePsdUint8Array(psd, { psb, generateThumbnail: false, noBackground: true })
}
