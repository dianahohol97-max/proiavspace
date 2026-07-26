import { NextResponse, type NextRequest } from 'next/server'
import { isAdminEmail } from '@/lib/admin'
import { B2Provider, R2Provider } from '@/lib/storage/R2Provider'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * One-off storage migration: copies every object from the R2 bucket into the
 * B2 bucket under the SAME key, so the database needs no changes. Admin-only.
 * Runs in time-boxed batches and returns a self-refreshing HTML page, so the
 * founder just opens /api/admin/migrate-storage once and watches it finish.
 * Idempotent: objects already present on B2 with the same size are skipped —
 * safe to re-run to catch stragglers uploaded mid-migration.
 */
export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const missing = [
    !process.env.R2_ACCOUNT_ID && 'R2_ACCOUNT_ID',
    !process.env.R2_ACCESS_KEY_ID && 'R2_ACCESS_KEY_ID',
    !process.env.R2_SECRET_ACCESS_KEY && 'R2_SECRET_ACCESS_KEY',
    !process.env.R2_BUCKET && 'R2_BUCKET',
    !process.env.B2_REGION && 'B2_REGION',
    !process.env.B2_KEY_ID && 'B2_KEY_ID',
    !process.env.B2_APPLICATION_KEY && 'B2_APPLICATION_KEY',
    !process.env.B2_BUCKET && 'B2_BUCKET',
  ].filter(Boolean)
  if (missing.length > 0) {
    return html(`<h2>Бракує змінних оточення</h2><p>${missing.join(', ')}</p>
      <p>Додайте їх у Vercel → Settings → Environment Variables і зробіть Redeploy.</p>`)
  }

  const source = new R2Provider({
    accountId: process.env.R2_ACCOUNT_ID!,
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    bucket: process.env.R2_BUCKET!,
  })
  const target = new B2Provider({
    region: process.env.B2_REGION!,
    keyId: process.env.B2_KEY_ID!,
    applicationKey: process.env.B2_APPLICATION_KEY!,
    bucket: process.env.B2_BUCKET!,
  })

  const cursor = Math.max(0, Number(request.nextUrl.searchParams.get('cursor') ?? 0) || 0)

  try {
    const [sourceObjects, targetObjects] = await Promise.all([
      source.list(''),
      target.list(''),
    ])
    const done = new Map(targetObjects.map((o) => [o.key, o.sizeBytes]))

    const deadline = Date.now() + 8000
    let index = cursor
    let copied = 0
    let skipped = 0

    for (; index < sourceObjects.length; index++) {
      if (Date.now() > deadline) break
      const obj = sourceObjects[index]
      if (done.get(obj.key) === obj.sizeBytes) {
        skipped++
        continue
      }
      const readUrl = await source.getSignedReadUrl(obj.key, { expiresInSeconds: 600 })
      const download = await fetch(readUrl)
      if (!download.ok) throw new Error(`GET ${obj.key}: ${download.status}`)
      const bytes = await download.arrayBuffer()
      const contentType = download.headers.get('content-type') ?? 'application/octet-stream'
      const { url: putUrl } = await target.getUploadUrl({
        key: obj.key,
        contentType,
        expiresInSeconds: 600,
      })
      const upload = await fetch(putUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: bytes,
      })
      if (!upload.ok) throw new Error(`PUT ${obj.key}: ${upload.status}`)
      copied++
    }

    const finished = index >= sourceObjects.length
    if (finished) {
      return html(`<h2>✅ Міграцію завершено</h2>
        <p>Всього обʼєктів у R2: ${sourceObjects.length}. Цим запуском скопійовано: ${copied}, пропущено (вже були): ${skipped}.</p>
        <p>Тепер у Vercel постав <code>STORAGE_PROVIDER=b2</code> і зроби Redeploy.</p>`)
    }
    return html(
      `<h2>Копіюю… ${index} / ${sourceObjects.length}</h2>
       <p>Цим кроком: скопійовано ${copied}, пропущено ${skipped}. Сторінка оновиться сама.</p>`,
      `<meta http-equiv="refresh" content="1;url=/api/admin/migrate-storage?cursor=${index}">`
    )
  } catch (error) {
    return html(`<h2>⚠️ Помилка</h2><pre>${(error as Error).message}</pre>
      <p><a href="/api/admin/migrate-storage?cursor=${cursor}">Спробувати ще раз із цього ж місця</a></p>`)
  }
}

function html(body: string, head = ''): NextResponse {
  return new NextResponse(
    `<!doctype html><html lang="uk"><head><meta charset="utf-8">${head}
     <style>body{font:16px/1.6 -apple-system,sans-serif;max-width:640px;margin:60px auto;padding:0 20px}</style>
     </head><body>${body}</body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
}
