// Mock of our Next API (+ its latency from Bucharest → Vercel fra1 → Supabase/B2)
// and of B2's S3 endpoint (CORS preflight, PUT, multipart parts, ETag).
// APP_PORT serves the harness + /api/*, STORE_PORT is the "bucket" (put the
// link proxy in front of it), STORE_PUBLIC is the URL the browser uses.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const APP = +process.env.APP_PORT, STORE = +process.env.STORE_PORT
const STORE_PUBLIC = process.env.STORE_PUBLIC
const STATIC = process.env.STATIC_DIR
const NO_ETAG = process.env.NO_ETAG === '1'
const B2_MS = +(process.env.B2_MS ?? 150)        // B2 time to answer a PUT once the body is in
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
// Route time = Vercel function + Supabase queries (+ B2 call from fra1 where the route makes one).
const API_MS = { presign: 120, complete: 300, 'multipart/create': 350, 'multipart/part-urls': 150,
  'multipart/list-parts': 250, 'multipart/complete': 550, 'multipart/abort': 250 }
const API_RTT = +(process.env.API_RTT ?? 40)

const objects = new Map()          // key → size
const uploads = new Map()          // uploadId → { key, parts: Map<n,{size,etag}> }
const log = { puts: 0, partPuts: 0, preflights: 0, completes: [], bytes: 0, apiCalls: {} }

const json = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)) }
const readJson = (req) => new Promise((ok) => { let s = ''; req.on('data', (c) => (s += c)); req.on('end', () => ok(s ? JSON.parse(s) : null)) })

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x')
  if (url.pathname.startsWith('/api/uploads/')) {
    const route = url.pathname.slice('/api/uploads/'.length)
    const body = await readJson(req)
    log.apiCalls[route] = (log.apiCalls[route] || 0) + 1
    await sleep(API_RTT + (API_MS[route] ?? 100))
    const key = () => `u/U/g/${body.galleryId}/${body.variant ? 'v' : 'o'}/${crypto.randomUUID()}-${body.fileName}`
    switch (route) {
      case 'presign': { const k = key(); return json(res, 200, { key: k, uploadUrl: `${STORE_PUBLIC}/${k}?sig=${crypto.randomUUID()}` }) }
      case 'complete': {
        if (!objects.has(body.key)) return json(res, 400, { error: 'upload_missing' })
        log.completes.push({ t: Date.now(), key: body.key, variants: Object.keys(body.variants || {}) })
        return json(res, 200, { assetId: crypto.randomUUID() })
      }
      case 'multipart/create': { const k = key(); const id = crypto.randomUUID(); uploads.set(id, { key: k, parts: new Map() }); return json(res, 200, { key: k, uploadId: id }) }
      case 'multipart/part-urls': {
        const urls = {}; for (const n of body.partNumbers) urls[n] = `${STORE_PUBLIC}/${body.key}?partNumber=${n}&uploadId=${body.uploadId}&sig=${crypto.randomUUID()}`
        return json(res, 200, { urls })
      }
      case 'multipart/list-parts': {
        const u = uploads.get(body.uploadId); if (!u) return json(res, 404, { error: 'upload_not_found' })
        return json(res, 200, { parts: [...u.parts].sort((a, b) => a[0] - b[0]).map(([n, p]) => ({ partNumber: n, etag: p.etag, sizeBytes: p.size })) })
      }
      case 'multipart/complete': {
        const u = uploads.get(body.uploadId)
        if (!u) return objects.has(body.key) ? json(res, 200, { assetId: 'again' }) : json(res, 400, { error: 'upload_missing' })
        let total = 0; const want = body.parts ?? [...u.parts.keys()].sort((a, b) => a - b).map((n) => ({ partNumber: n, etag: u.parts.get(n).etag }))
        for (const p of want) { const s = u.parts.get(p.partNumber); if (!s || s.etag !== p.etag) return json(res, 422, { error: 'parts_invalid' }); total += s.size }
        if (total !== body.sizeBytes) return json(res, 422, { error: 'parts_size_mismatch', total })
        objects.set(body.key, total); uploads.delete(body.uploadId)
        log.completes.push({ t: Date.now(), key: body.key, variants: Object.keys(body.variants || {}), multipart: true, viaListParts: !body.parts })
        return json(res, 200, { assetId: crypto.randomUUID() })
      }
      case 'multipart/abort': uploads.delete(body.uploadId); return json(res, 200, { ok: true })
    }
    return json(res, 404, {})
  }
  if (url.pathname === '/__log') { json(res, 200, { ...log, openUploads: uploads.size }); return }
  if (url.pathname === '/__reset') { objects.clear(); uploads.clear(); Object.assign(log, { puts: 0, partPuts: 0, preflights: 0, completes: [], bytes: 0, apiCalls: {} }); return json(res, 200, {}) }
  if (url.pathname === '/__uploads') return json(res, 200, [...uploads].map(([id, u]) => ({ id, key: u.key, parts: [...u.parts.keys()] })))
  const file = path.join(STATIC, url.pathname === '/' ? 'index.html' : url.pathname)
  if (!file.startsWith(STATIC) || !fs.existsSync(file)) { res.writeHead(404); return res.end() }
  res.writeHead(200, { 'content-type': file.endsWith('.html') ? 'text/html' : 'text/javascript', 'cache-control': 'no-store' })
  fs.createReadStream(file).pipe(res)
}).listen(APP, '127.0.0.1')

const cors = (origin) => ({
  'access-control-allow-origin': origin || '*',
  'access-control-allow-methods': 'GET, PUT, HEAD',
  'access-control-allow-headers': 'content-type, content-length',
  'access-control-max-age': '3600',
  ...(NO_ETAG ? {} : { 'access-control-expose-headers': 'ETag' }),
})
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x')
  const key = decodeURIComponent(url.pathname.slice(1))
  if (req.method === 'OPTIONS') { log.preflights++; res.writeHead(204, cors(req.headers.origin)); return res.end() }
  if (req.method !== 'PUT') { res.writeHead(405, cors(req.headers.origin)); return res.end() }
  let size = 0
  req.on('data', (c) => { size += c.length; log.bytes += c.length })
  req.on('aborted', () => {})
  req.on('end', async () => {
    await sleep(B2_MS)
    const etag = crypto.randomBytes(16).toString('hex')
    const n = url.searchParams.get('partNumber')
    if (n) {
      const u = uploads.get(url.searchParams.get('uploadId'))
      if (!u) { res.writeHead(404, cors(req.headers.origin)); return res.end('NoSuchUpload') }
      u.parts.set(+n, { size, etag }); log.partPuts++
    } else { objects.set(key, size); log.puts++ }
    res.writeHead(200, { ...cors(req.headers.origin), etag: `"${etag}"` }); res.end()
  })
}).listen(STORE, '127.0.0.1')
console.log('mock up', APP, STORE)
