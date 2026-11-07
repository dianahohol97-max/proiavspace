import fs from 'node:fs'; import path from 'node:path'; import http from 'node:http'; import { createRequire } from 'node:module'
const { chromium } = createRequire(new URL('../../package.json', import.meta.url))('playwright')
const B = path.dirname(new URL(import.meta.url).pathname); const [v, set] = process.argv.slice(2)
const srv = http.createServer((req, res) => { const f = path.join(B, 'static', new URL(req.url, 'http://x').pathname); if (!fs.existsSync(f)) { res.writeHead(404); return res.end() } res.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html' : 'text/javascript' }); fs.createReadStream(f).pipe(res) }).listen(4300)
const ticks = () => { const m = new Map(); for (const pid of fs.readdirSync('/proc')) { if (!/^\d+$/.test(pid)) continue; try { const s = fs.readFileSync(`/proc/${pid}/stat`, 'utf8'); if (!/chrom|headless/i.test(s.slice(s.indexOf('(') + 1, s.lastIndexOf(')')))) continue; const f = s.slice(s.lastIndexOf(')') + 2).split(' '); m.set(pid, +f[11] + +f[12]) } catch {} } return m }
const peakRss = () => { let kb = 0; for (const pid of fs.readdirSync('/proc')) { if (!/^\d+$/.test(pid)) continue; try { const s = fs.readFileSync(`/proc/${pid}/status`, 'utf8'); if (!/Name:\s*(chrom|headless)/i.test(s)) continue; kb += +(s.match(/VmRSS:\s+(\d+)/)?.[1] ?? 0) } catch {} } return kb }
const browser = await chromium.launch(); const page = await browser.newPage()
await page.goto(`http://127.0.0.1:4300/render.html?v=${v}`); await page.waitForFunction(() => window.ready)
await page.setInputFiles('#f', fs.readdirSync(path.join(B, 'data', set)).sort().map((f) => path.join(B, 'data', set, f)))
let peak = 0; const iv = setInterval(() => { peak = Math.max(peak, peakRss()) }, 200)
const t0 = ticks(); const r = await page.evaluate(() => window.go()); let cpu = 0; for (const [p, x] of ticks()) cpu += x - (t0.get(p) ?? 0)
clearInterval(iv)
const out = { kind: 'render', v, set, ...r, cpuS: +(cpu / 100).toFixed(1), peakRssMB: Math.round(peak / 1024) }
console.log(JSON.stringify(out)); fs.appendFileSync(path.join(B, 'data', 'results.jsonl'), JSON.stringify(out) + '\n')
await browser.close(); srv.close()
