// node run.mjs <before|after> <png|jpg> [--per-conn=MBIT] [--conc=N] [--no-etag] [--offline=ms@s] [--blackhole=ms@s] [--reload-at=s] [--files=N]
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
const require = createRequire(new URL('../../package.json', import.meta.url))
const { chromium } = require('playwright')

const B = path.dirname(new URL(import.meta.url).pathname)
const [version, set, ...rest] = process.argv.slice(2)
const opt = Object.fromEntries(rest.map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? '1'] }))
const conc = +(opt.conc || (version === 'before' ? 5 : 8))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const kids = []
const start = (file, env) => { const p = spawn('node', [path.join(B, file)], { env: { ...process.env, ...env }, stdio: ['ignore', 'ignore', 'inherit'] }); kids.push(p); return p }
start('mock.mjs', { APP_PORT: 4000, STORE_PORT: 4001, STORE_PUBLIC: 'http://127.0.0.1:4101', STATIC_DIR: path.join(B, 'static'), NO_ETAG: opt['no-etag'] ? '1' : '0' })
start('link-proxy.mjs', { LISTEN: 4101, TARGET: 4001, CTL: 4201, UP_MBIT: opt.up || 20, DELAY_MS: 60, PER_CONN_MBIT: opt['per-conn'] || 0 })
await sleep(600)

function chromeCpu() {
  const ticks = new Map()
  for (const pid of fs.readdirSync('/proc')) {
    if (!/^\d+$/.test(pid)) continue
    try {
      const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8')
      const comm = stat.slice(stat.indexOf('(') + 1, stat.lastIndexOf(')'))
      if (!/chrom|headless/i.test(comm)) continue
      const f = stat.slice(stat.lastIndexOf(')') + 2).split(' ')
      ticks.set(pid, +f[11] + +f[12])
    } catch {}
  }
  return ticks
}
// CPU seconds since `start`: per process, so a helper process that exits in
// between does not make the sum negative (its time is lost — a slight underestimate).
const cpuSince = (start) => { let t = 0; for (const [pid, v] of chromeCpu()) t += v - (start.get(pid) ?? 0); return t / 100 }

const files = fs.readdirSync(path.join(B, 'data', set)).sort().slice(0, +(opt.files || 16)).map((f) => path.join(B, 'data', set, f))
const totalMB = files.reduce((s, f) => s + fs.statSync(f).size, 0) / 1048576
const browser = await chromium.launch()
const context = await browser.newContext()
const page = await context.newPage()
page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') console.error('[page]', m.text().slice(0, 300)) })
const open = async (list = files) => { await page.goto(`http://127.0.0.1:4000/?v=${version}`); await page.waitForFunction(() => window.ready); await page.setInputFiles('#f', list) }
await open()
const cpu0 = chromeCpu()
await page.evaluate(() => window.resetProbe())
const t0 = Date.now()
const run = page.evaluate((c) => window.runUploads(c), conc)

if (opt.offline) { const [ms, at] = opt.offline.split('@').map(Number); setTimeout(async () => { console.error(`-- offline ${ms}ms at ${at}s`); await context.setOffline(true); await sleep(ms); await context.setOffline(false); console.error('-- online') }, at * 1000) }
if (opt.blackhole) { const [ms, at] = opt.blackhole.split('@').map(Number); setTimeout(() => { console.error(`-- blackhole ${ms}ms at ${at}s`); fetch(`http://127.0.0.1:4201/blackhole?ms=${ms}`) }, at * 1000) }

let result
if (opt['reload-at']) {
  await sleep(+opt['reload-at'] * 1000)
  const before = await (await fetch('http://127.0.0.1:4000/__uploads')).json()
  const log0 = await (await fetch('http://127.0.0.1:4000/__log')).json()
  console.error(`-- reload at ${opt['reload-at']}s: completed=${log0.completes.length}, open multipart=${before.length}, parts stored=${before.reduce((s, u) => s + u.parts.length, 0)}, bytes so far=${(log0.bytes / 1048576).toFixed(0)}MB`)
  run.catch(() => {})
  const doneNames = new Set(log0.completes.map((c) => c.key.split('/').pop().replace(/^[0-9a-f-]{36}-/, '')))
  const remaining = files.filter((f) => !doneNames.has(path.basename(f)))
  console.error(`-- re-selecting ${remaining.length} unfinished files`)
  await open(remaining)
  const t1 = Date.now()
  result = await page.evaluate((c) => window.runUploads(c), conc)
  const log1 = await (await fetch('http://127.0.0.1:4000/__log')).json()
  console.error(`-- after reload: ${result.ms}ms more, total bytes on the wire ${(log1.bytes / 1048576).toFixed(0)}MB of ${totalMB.toFixed(0)}MB files; second pass ${(Date.now() - t1)}ms`)
} else {
  result = await run
}
const wall = Date.now() - t0
const cpu = cpuSince(cpu0)
const probe = await page.evaluate(() => window.probe())
const log = await (await fetch('http://127.0.0.1:4000/__log')).json()
const events = await page.evaluate(() => window.__events)
const waits = events.filter((e) => e.kind === 'wait')
const out = {
  version, set, conc, files: files.length, totalMB: +totalMB.toFixed(0), perConn: opt['per-conn'] || 0,
  seconds: +(result.ms / 1000).toFixed(1), wallS: +(wall / 1000).toFixed(1),
  effMbit: +((totalMB * 8.388608) / (result.ms / 1000)).toFixed(1),
  firstDoneS: +(Math.min(...result.doneAt) / 1000).toFixed(1),
  cpuS: +cpu.toFixed(1), ...probe, errors: result.errors.length, errorSample: result.errors.slice(0, 2),
  completes: log.completes.length, puts: log.puts, partPuts: log.partPuts, preflights: log.preflights,
  wireMB: +(log.bytes / 1048576).toFixed(0), viaListParts: log.completes.filter((c) => c.viaListParts).length,
  variantsPerFile: log.completes[0]?.variants.join('+'), waitEvents: waits.length, openUploads: log.openUploads,
}
console.log(JSON.stringify(out))
fs.appendFileSync(path.join(B, 'data', 'results.jsonl'), JSON.stringify({ ...out, opts: opt }) + '\n')
await browser.close()
for (const k of kids) k.kill()
process.exit(0)
