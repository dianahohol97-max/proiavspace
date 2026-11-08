/**
 * Responsive variants of the landing photos → public/landing/img/
 *   <name>-<width>.avif / .webp   (see src/components/landing/LandingPhoto.tsx)
 *
 * next.config keeps image optimization off (no on-the-fly resizing), so the
 * landing ships pre-sized files. Sources are the full-quality JPGs next to
 * the old 2000px WebPs. Re-run after changing a photo or the width sets:
 *
 *   npm i --no-save sharp && node scripts/landing-images.cjs
 *
 * Quality: AVIF 62 for the showcase set (foliage-heavy, kept on par with
 * WebP 78 by PSNR), 55 for the demo-gallery frames; WebP 78 everywhere.
 */
const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const R = path.join(__dirname, '..', 'public')
const OUT = path.join(R, 'landing', 'img')
fs.mkdirSync(OUT, { recursive: true })

// Keep in sync with LANDING_PHOTO_WIDTHS in LandingPhoto.tsx.
const SHOWCASE = ['01', '02', '03', '05', '06', '07', '08', '10', '11', '12', '13', '14', '15', '16']
const THEMES = ['15', '18', '01', '13', '16', '21']
const jobs = [
  ...SHOWCASE.map((n) => ({ src: `${R}/showcase/${n}.jpg`, name: `showcase-${n}`, widths: [240, 480, 720], avifQ: 62 })),
  ...THEMES.map((n) => ({ src: `${R}/themes/${n}.jpg`, name: `themes-${n}`, widths: [360, 720, 1080], avifQ: 55 })),
  { src: `${R}/themes/07.jpg`, name: 'themes-07', widths: [720, 1080, 1600], avifQ: 55 },
]

;(async () => {
  const total = { avif: 0, webp: 0, files: 0 }
  for (const job of jobs) {
    for (const width of job.widths) {
      const base = sharp(job.src).rotate().resize({ width, withoutEnlargement: true })
      const avif = await base.clone().avif({ quality: job.avifQ, effort: 6 }).toFile(`${OUT}/${job.name}-${width}.avif`)
      const webp = await base.clone().webp({ quality: 78, effort: 6 }).toFile(`${OUT}/${job.name}-${width}.webp`)
      total.avif += avif.size
      total.webp += webp.size
      total.files += 2
    }
  }
  console.log(`${total.files} files · AVIF ${(total.avif / 1024) | 0} KB · WebP ${(total.webp / 1024) | 0} KB`)
})()
