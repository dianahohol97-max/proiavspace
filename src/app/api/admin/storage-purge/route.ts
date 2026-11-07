import { NextResponse } from 'next/server'
import { isAdminEmail } from '@/lib/admin'
import { MAX_ATTEMPTS, isMissingTableError, purgeDryRun } from '@/lib/storage/purge'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Admin-only view of public.storage_purge_queue (LC-02): how much is waiting,
 * and the rows the hourly cron gave up on after MAX_ATTEMPTS — those are never
 * retried on their own and need a human (fix the cause, then reset attempts).
 */
export async function GET() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) {
    return new NextResponse('Not found', { status: 404 })
  }
  const admin = createSupabaseAdminClient()
  const escape = (text: string) => text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)
  const mode = purgeDryRun(process.env.STORAGE_PURGE_MODE, false)
    ? '🟡 dry-run — нічого не видаляється, лише лог (STORAGE_PURGE_MODE ≠ live)'
    : '🔴 live — файли видаляються з B2'

  let body: string
  if (!admin) {
    body = '<p>❌ SUPABASE_SERVICE_ROLE_KEY не налаштовано.</p>'
  } else {
    const table = admin.from('storage_purge_queue')
    const pending = await table.select('id', { count: 'exact', head: true }).is('purged_at', null).lt('attempts', MAX_ATTEMPTS)
    if (isMissingTableError(pending.error)) {
      body = '<p>Таблиці storage_purge_queue ще немає — міграція 0057 не застосована. Крон тихо пропускає запуски.</p>'
    } else if (pending.error) {
      body = `<p>❌ Помилка читання черги: ${escape(pending.error.message)}</p>`
    } else {
      const purged = await admin.from('storage_purge_queue').select('id', { count: 'exact', head: true }).not('purged_at', 'is', null)
      const stuck = await admin
        .from('storage_purge_queue')
        .select('id, key, kind, owner_id, attempts, last_error, enqueued_at')
        .is('purged_at', null)
        .gte('attempts', MAX_ATTEMPTS)
        .order('enqueued_at', { ascending: true })
        .limit(200)
      const rows = (stuck.data ?? []) as {
        id: number
        key: string
        kind: string
        attempts: number
        last_error: string | null
        enqueued_at: string
      }[]
      body =
        `<p>Чекають обробки: <b>${pending.count ?? 0}</b> · видалено: <b>${purged.count ?? 0}</b> · ` +
        `застрягли (≥ ${MAX_ATTEMPTS} спроб): <b>${rows.length}</b></p>` +
        (rows.length === 0
          ? '<p>✅ Застряглих записів немає.</p>'
          : `<table style="border-collapse:collapse;font-size:13px"><tr><th align="left">id</th><th align="left">ключ</th><th>спроб</th><th align="left">помилка</th><th align="left">у черзі з</th></tr>${rows
              .map(
                (r) =>
                  `<tr style="border-top:1px solid #ddd"><td>${r.id}</td><td><code>${escape(r.kind)}: ${escape(r.key)}</code></td><td align="center">${r.attempts}</td><td>${escape(r.last_error ?? '')}</td><td>${escape(r.enqueued_at)}</td></tr>`
              )
              .join('')}</table>
<p style="color:#777;font-size:14px">Щоб крон спробував знову, коли причину усунено: <code>update public.storage_purge_queue set attempts = 0, last_error = null where id = …;</code> Записи з «unsafe key refused» не повертати — з ними треба розібратися вручну.</p>`)
    }
  }

  const html = `<!doctype html><html lang="uk"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Черга видалення файлів · проЯв</title></head><body style="font-family:system-ui,sans-serif;max-width:960px;margin:60px auto;line-height:1.6;padding:0 20px;color:#1c1b1a"><h1 style="font-size:22px">Черга видалення файлів акаунтів (LC-02)</h1><p>Режим: ${mode}</p>${body}</body></html>`
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
