// Renders the phone-app icons (public/app/*.png) from public/app/icon.svg.
// Run: node scripts/app-icons.mjs  (uses the Playwright Chromium)
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = join(process.cwd(), 'public', 'app')
const svg = readFileSync(join(dir, 'icon.svg'), 'utf8')
// Maskable: the mark shrunk into the 80% safe zone (Android crops to a circle/squircle).
const maskable = svg.replace('translate(96 96) scale(13.333)', 'translate(141 141) scale(9.583)')
const targets = [
  ['icon-192.png', svg, 192],
  ['icon-512.png', svg, 512],
  ['icon-maskable-512.png', maskable, 512],
  ['apple-touch-icon.png', svg, 180],
  ['badge-96.png', null, 96],
]
const browser = await chromium.launch()
const page = await browser.newPage()
for (const [name, source, size] of targets) {
  // Badge: monochrome mark on transparent (Android status bar).
  const markup =
    source ??
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24"><path d="M3 8V5.5A2.5 2.5 0 0 1 5.5 3H8M16 3h2.5A2.5 2.5 0 0 1 21 5.5V8M21 16v2.5a2.5 2.5 0 0 1-2.5 2.5H16M8 21H5.5A2.5 2.5 0 0 1 3 18.5V16" fill="none" stroke="#000" stroke-width="2.3" stroke-linecap="round"/><circle cx="12" cy="12" r="3.6" fill="#000"/></svg>`
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${markup}`
  )
  await page.screenshot({ path: join(dir, name), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } })
  console.log('wrote', name)
}
await browser.close()
