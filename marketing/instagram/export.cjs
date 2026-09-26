// Експорт постів з posts.html у PNG 1080×1350 (4:5).
//   npm i -D playwright  (або глобально)  →  node marketing/instagram/export.cjs
// PNG лягають у marketing/instagram/png/post-01.png … post-07.png.
const path = require('path')
const fs = require('fs')
const { chromium } = require('playwright')

;(async () => {
  const outDir = path.join(__dirname, 'png')
  fs.mkdirSync(outDir, { recursive: true })
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1200, height: 1500 } })
  await page.goto('file://' + path.join(__dirname, 'posts.html'))
  await page.evaluate(() => document.fonts.ready)
  await page.waitForLoadState('networkidle')
  for (const post of await page.$$('section.post, section.story')) {
    const id = await post.getAttribute('id')
    await post.screenshot({ path: path.join(outDir, `${id}.png`) })
    console.log('✓', id)
  }
  await browser.close()
})()
