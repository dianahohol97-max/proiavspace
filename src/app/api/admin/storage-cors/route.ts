import {
  GetBucketCorsCommand,
  PutBucketCorsCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { NextResponse } from 'next/server'
import { isAdminEmail } from '@/lib/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Admin-only one-click CORS setup for the B2 bucket. The client gallery's
 * «Завантажити все» builds the zip in the browser by fetch()-ing presigned
 * originals straight from B2 — that needs a CORS rule allowing GET from the
 * app origin (img tags and <a> downloads don't, which is why everything else
 * works without it). One rule covers uploads too (PUT + exposed ETag for
 * multipart parts).
 */
export async function GET() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) {
    return new NextResponse('Not found', { status: 404 })
  }

  const region = process.env.B2_REGION
  const keyId = process.env.B2_KEY_ID
  const appKey = process.env.B2_APPLICATION_KEY
  const bucket = process.env.B2_BUCKET
  if (!region || !keyId || !appKey || !bucket) {
    return page('❌ B2_* env не налаштовані повністю — перевір Vercel → Environment Variables.')
  }

  const client = new S3Client({
    region,
    endpoint: `https://s3.${region}.backblazeb2.com`,
    credentials: { accessKeyId: keyId, secretAccessKey: appKey },
  })

  let before = 'не вдалося прочитати (можливо, правил ще нема)'
  try {
    const current = await client.send(new GetBucketCorsCommand({ Bucket: bucket }))
    before = JSON.stringify(current.CORSRules ?? [], null, 2)
  } catch {
    /* NoSuchCORSConfiguration → keep the friendly default text */
  }

  try {
    await client.send(
      new PutBucketCorsCommand({
        Bucket: bucket,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedOrigins: [
                'https://proiav.space',
                'https://www.proiav.space',
                'https://*.vercel.app',
                'http://localhost:3000',
              ],
              AllowedMethods: ['GET', 'PUT', 'HEAD'],
              AllowedHeaders: ['*'],
              ExposeHeaders: ['ETag'],
              MaxAgeSeconds: 3600,
            },
          ],
        },
      })
    )
  } catch (cause) {
    return page(
      `⚠️ Не вдалося записати CORS: ${cause instanceof Error ? cause.message : 'помилка'}. ` +
        'Найчастіше це ключ B2 без прав writeBucket — потрібен Application Key з доступом до налаштувань бакета.'
    )
  }

  return page(
    '✅ CORS для бакета оновлено: GET/PUT/HEAD з proiav.space (+ ETag для завантажень частинами). ' +
      '«Завантажити все» в галереї запрацює одразу — онови сторінку галереї і спробуй. ' +
      `Було: <pre style="white-space:pre-wrap;font-size:12px;background:#f4f2ee;padding:12px;border-radius:8px">${escapeHtml(before)}</pre>`
  )
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function page(line: string): NextResponse {
  const html = `<!doctype html><html lang="uk"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>CORS сховища · проЯв</title></head><body style="font-family:system-ui,sans-serif;max-width:640px;margin:80px auto;line-height:1.65;padding:0 20px;color:#1c1b1a"><h1 style="font-size:22px">CORS для сховища B2</h1><p style="font-size:16px">${line}</p></body></html>`
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
