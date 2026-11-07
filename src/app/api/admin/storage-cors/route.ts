import {
  GetBucketCorsCommand,
  PutBucketCorsCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { NextResponse } from 'next/server'
import { isAdminEmail } from '@/lib/admin'
import { DESIRED_CORS_RULES, applyStorageCors, type CorsClient } from '@/lib/storage/cors'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Admin-only one-click CORS setup for the B2 bucket: writes the FULL rule set
 * from src/lib/storage/cors.ts (uploads PUT + exposed ETag; GET/HEAD from
 * proiav.space and www for «Завантажити все» and album print export).
 * Idempotent: reads the current rules first and writes nothing when they
 * already match; the page shows the rules before and after. Opening it again
 * is always safe. Docs: docs/STORAGE_CORS.md.
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

  const s3 = new S3Client({
    region,
    endpoint: `https://s3.${region}.backblazeb2.com`,
    credentials: { accessKeyId: keyId, secretAccessKey: appKey },
  })
  const client: CorsClient = {
    async get() {
      try {
        const current = await s3.send(new GetBucketCorsCommand({ Bucket: bucket }))
        return (current.CORSRules ?? []) as Awaited<ReturnType<CorsClient['get']>>
      } catch {
        // No rules yet (NoSuchCORSConfiguration) or unreadable: unknown → write.
        return null
      }
    },
    async put(rules) {
      await s3.send(new PutBucketCorsCommand({ Bucket: bucket, CORSConfiguration: { CORSRules: rules } }))
    },
  }

  let result
  try {
    result = await applyStorageCors(client)
  } catch (cause) {
    return page(
      `⚠️ Не вдалося прочитати або записати CORS: ${escapeHtml(cause instanceof Error ? cause.message : 'помилка')}. ` +
        'Найчастіше це ключ B2 без прав readBuckets/writeBuckets — потрібен Application Key з доступом до налаштувань бакета. ' +
        'Запасний шлях — CLI, див. docs/STORAGE_CORS.md.'
    )
  }

  const headline = result.changed
    ? `✅ CORS бакета <b>${escapeHtml(bucket)}</b> оновлено: повний набір правил записано.`
    : `✅ CORS бакета <b>${escapeHtml(bucket)}</b> уже актуальний — нічого не змінено.`
  return page(
    `${headline}<br>` +
      'Завантаження (PUT, ETag для докачування частинами) — з proiav.space, www, *.vercel.app, localhost:3000; ' +
      'читання оригіналів (GET/HEAD: «Завантажити все», експорт альбомів) — з https://proiav.space і https://www.proiav.space. ' +
      'Повторне відкриття сторінки безпечне.' +
      section('Було', result.before) +
      section('Стало', result.after) +
      section('Очікуваний набір', DESIRED_CORS_RULES)
  )
}

function section(title: string, rules: unknown): string {
  const body = rules === null ? 'не вдалося прочитати (можливо, правил ще немає)' : JSON.stringify(rules, null, 2)
  return `<h2 style="font-size:16px;margin-top:28px">${title}</h2><pre style="white-space:pre-wrap;font-size:12px;background:#f4f2ee;padding:12px;border-radius:8px">${escapeHtml(body)}</pre>`
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function page(line: string): NextResponse {
  const html = `<!doctype html><html lang="uk"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>CORS сховища · проЯв</title></head><body style="font-family:system-ui,sans-serif;max-width:720px;margin:60px auto;line-height:1.65;padding:0 20px;color:#1c1b1a"><h1 style="font-size:22px">CORS для сховища B2</h1><p style="font-size:16px">${line}</p></body></html>`
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
