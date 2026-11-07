/**
 * EXIF orientation (1–8) applied while drawing — for embedded RAW previews,
 * which are stored as the sensor saw them and carry no orientation of their own.
 */
export function orientedSize(w: number, h: number, orientation: number): [number, number] {
  return orientation >= 5 && orientation <= 8 ? [h, w] : [w, h]
}

/** Draws `src` (size sw×sh) into a W×H (oriented) area of `ctx`. */
export function drawOriented(
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
  src: CanvasImageSource,
  orientation: number,
  W: number,
  H: number
) {
  const swap = orientation >= 5 && orientation <= 8
  const dw = swap ? H : W
  const dh = swap ? W : H
  ctx.save()
  switch (orientation) {
    case 2: ctx.setTransform(-1, 0, 0, 1, W, 0); break
    case 3: ctx.setTransform(-1, 0, 0, -1, W, H); break
    case 4: ctx.setTransform(1, 0, 0, -1, 0, H); break
    case 5: ctx.setTransform(0, 1, 1, 0, 0, 0); break
    case 6: ctx.setTransform(0, 1, -1, 0, W, 0); break
    case 7: ctx.setTransform(0, -1, -1, 0, W, H); break
    case 8: ctx.setTransform(0, -1, 1, 0, 0, H); break
    default: ctx.setTransform(1, 0, 0, 1, 0, 0)
  }
  ctx.drawImage(src, 0, 0, dw, dh)
  ctx.restore()
}

/**
 * Decodes a JPEG blob. `fromImage`: let the decoder apply the JPEG's own EXIF
 * orientation (plain JPEG files; previews that carry it) — then nothing is
 * applied on top. Otherwise the caller applies the RAW's orientation.
 */
export async function decode(blob: Blob, fromImage: boolean): Promise<ImageBitmap> {
  if (fromImage) {
    try {
      return await createImageBitmap(blob, { imageOrientation: 'from-image' } as ImageBitmapOptions)
    } catch {
      /* older engines: fall through */
    }
  }
  return createImageBitmap(blob)
}
