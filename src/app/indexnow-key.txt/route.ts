/**
 * IndexNow key file (Bing, Yandex, Seznam…). The key lives in the
 * INDEXNOW_KEY env; submissions pass keyLocation=/indexnow-key.txt.
 * The ".txt" keeps the path out of the locale middleware.
 */
export const dynamic = 'force-dynamic'

export function GET() {
  const key = process.env.INDEXNOW_KEY
  if (!key) return new Response('Not found', { status: 404 })
  return new Response(key, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
