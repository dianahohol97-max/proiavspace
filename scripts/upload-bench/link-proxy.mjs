// Emulated access link between the browser and "B2": shared uplink rate,
// one-way delay, per-connection in-flight window (≈ TCP cwnd), handshake cost
// (TCP + TLS = 2 RTT) and an optional per-connection rate cap (loss-limited TCP).
// Control: GET http://127.0.0.1:<ctl>/blackhole?ms=30000  (stop forwarding, keep sockets)
import net from 'node:net'
import http from 'node:http'

const cfg = {
  listen: +process.env.LISTEN, target: +process.env.TARGET, ctl: +(process.env.CTL || 0),
  upRate: (+process.env.UP_MBIT || 20) * 1e6 / 8, downRate: (+process.env.DOWN_MBIT || 100) * 1e6 / 8,
  delay: +(process.env.DELAY_MS ?? 60), window: +(process.env.WINDOW_KB || 512) * 1024,
  handshakeRtt: +(process.env.HANDSHAKE_RTT ?? 2), perConn: (+process.env.PER_CONN_MBIT || 0) * 1e6 / 8,
}
const up = { freeAt: 0 }, down = { freeAt: 0 }
let blackholeUntil = 0
let conns = 0, maxConns = 0
const SLICE = 16 * 1024

function pipe(src, dst, dir, rate, conn, readyAt) {
  let queued = 0, paused = false, ended = false, pending = 0
  const maybeEnd = () => { if (ended && pending === 0) dst.end() }
  src.on('data', (chunk) => {
    for (let off = 0; off < chunk.length; off += SLICE) {
      const slice = chunk.subarray(off, off + SLICE)
      const now = Date.now()
      let start = Math.max(now, dir.freeAt, readyAt, blackholeUntil)
      dir.freeAt = start + (slice.length / rate) * 1000
      let depart = dir.freeAt
      if (conn && cfg.perConn && dir === up) {
        const s2 = Math.max(start, conn.freeAt)
        conn.freeAt = s2 + (slice.length / cfg.perConn) * 1000
        depart = Math.max(depart, conn.freeAt)
      }
      const deliver = () => {
        if (Date.now() < blackholeUntil) return setTimeout(deliver, blackholeUntil - Date.now())
        if (!dst.destroyed) dst.write(slice)
        queued -= slice.length; pending--
        if (paused && queued < cfg.window) { paused = false; src.resume() }
        maybeEnd()
      }
      queued += slice.length; pending++
      setTimeout(deliver, depart + cfg.delay - now)
    }
    if (queued >= cfg.window && !paused) { paused = true; src.pause() }
  })
  src.on('end', () => { ended = true; maybeEnd() })
  src.on('error', () => dst.destroy())
  src.on('close', () => { if (pending === 0) dst.destroy() ; else ended = true })
}

net.createServer((client) => {
  conns++; maxConns = Math.max(maxConns, conns)
  client.on('close', () => conns--)
  const server = net.connect(cfg.target, '127.0.0.1')
  const readyAt = Date.now() + cfg.handshakeRtt * 2 * cfg.delay
  const conn = { freeAt: 0 }
  pipe(client, server, up, cfg.upRate, conn, readyAt)
  pipe(server, client, down, cfg.downRate, null, 0)
}).listen(cfg.listen, '127.0.0.1')

if (cfg.ctl) http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x')
  if (url.pathname === '/blackhole') blackholeUntil = Date.now() + +url.searchParams.get('ms')
  if (url.pathname === '/stats') { res.end(JSON.stringify({ conns, maxConns })); maxConns = conns; return }
  res.end('ok')
}).listen(cfg.ctl, '127.0.0.1')
console.log('link', JSON.stringify(cfg))
