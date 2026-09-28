import { NextResponse } from 'next/server'
import { isAdminEmail } from '@/lib/admin'
import { missingMigrations } from '@/lib/schema-check'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Admin-only diagnostics for the payment setup. Answers two questions the
 * dashboard can't: is MONOBANK_TOKEN a valid *acquiring* token (personal-API
 * and test tokens are rejected by the merchant endpoints), and which merchant
 * name is bound to it — that name is what payers see on the payment page.
 * Plus: is the database on the migrations this deploy needs (lib/schema-check)
 * — without them the webhook cannot apply a paid plan.
 */
export async function GET() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) {
    return new NextResponse('Not found', { status: 404 })
  }

  const token = process.env.MONOBANK_TOKEN
  let line: string
  if (!token) {
    line = '❌ MONOBANK_TOKEN не налаштовано у Vercel (Settings → Environment Variables).'
  } else {
    try {
      const res = await fetch('https://api.monobank.ua/api/merchant/details', {
        headers: { 'X-Token': token },
        cache: 'no-store',
      })
      if (res.ok) {
        const d = (await res.json()) as { merchantId?: string; merchantName?: string }
        line =
          `✅ Токен робочий. Мерчант: «${d.merchantName ?? '?'}» (id: ${d.merchantId ?? '?'}). ` +
          'Саме ця назва показується великим шрифтом на сторінці оплати — змінюється вона в кабінеті еквайрингу monobank, не через токен.'
      } else {
        const text = (await res.text()).slice(0, 300)
        line =
          res.status === 401 || res.status === 403
            ? `❌ Monobank відхиляє цей токен (HTTP ${res.status}). Найчастіша причина: це особистий або тестовий токен, а не токен «Інтернет-еквайрингу». Потрібен токен з web.monobank.ua → Еквайринг → твоя точка продажу → API. Відповідь monobank: ${text}`
            : `⚠️ Monobank повернув HTTP ${res.status}: ${text}`
      }
    } catch (cause) {
      line = `⚠️ Не вдалося звернутись до Monobank: ${cause instanceof Error ? cause.message : 'невідома помилка'}`
    }
  }

  const escape = (text: string) => text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)
  let dbLine: string
  const admin = createSupabaseAdminClient()
  if (!admin) {
    dbLine = '❌ SUPABASE_SERVICE_ROLE_KEY не налаштовано — вебхук оплати не зможе застосувати тариф.'
  } else {
    const missing = await missingMigrations(admin)
    dbLine =
      missing.length === 0
        ? '✅ База на потрібних міграціях.'
        : `❌ У базі бракує міграцій — оплата не застосує тариф, поки їх не накотити:<br>${missing
            .map((m) => `• <b>${escape(m.migration)}</b> — ${escape(m.what)} <span style="color:#777">(${escape(m.error)})</span>`)
            .join('<br>')}`
  }

  const html = `<!doctype html><html lang="uk"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Перевірка оплат · проЯв</title></head><body style="font-family:system-ui,sans-serif;max-width:640px;margin:80px auto;line-height:1.65;padding:0 20px;color:#1c1b1a"><h1 style="font-size:22px">Перевірка налаштувань оплати</h1><p style="font-size:16px">${line}</p><p style="font-size:16px">${dbLine}</p><p style="color:#777;font-size:14px">Після зміни токена у Vercel обовʼязково натисни Redeploy — env підхоплюється лише новим деплоєм. Потім онови цю сторінку.</p></body></html>`
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
