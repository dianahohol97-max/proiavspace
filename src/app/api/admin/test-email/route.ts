import { NextResponse, type NextRequest } from 'next/server'
import { isAdminEmail } from '@/lib/admin'
import { isEmailConfigured, sendEmailDetailed } from '@/lib/email'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Admin-only: send one test email through the same path as booking and promo
 * mail (lib/email → Brevo) and return Brevo's answer, so delivery can be
 * checked without creating a booking. POST {"to": "you@example.com"}.
 */
export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) {
    return new NextResponse('Not found', { status: 404 })
  }

  const body = (await request.json().catch(() => null)) as { to?: unknown } | null
  const to = typeof body?.to === 'string' ? body.to.trim() : ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || to.length > 254) {
    return NextResponse.json({ error: 'invalid_to' }, { status: 400 })
  }
  if (!isEmailConfigured()) {
    return NextResponse.json({ error: 'not_configured', missing: 'BREVO_API_KEY / EMAIL_FROM' }, { status: 503 })
  }

  const sentAt = new Date().toISOString()
  const result = await sendEmailDetailed({
    to,
    subject: 'проЯв · тестовий лист',
    text: [
      'Привіт! Це тестовий лист із proiav.space.',
      '',
      `Надіслано ${sentAt} через Brevo (той самий шлях, що й листи про броні та промо).`,
      'Якщо він дійшов — пошта налаштована.',
    ].join('\n'),
  })

  return NextResponse.json(
    { sent: result.ok, to, from: process.env.EMAIL_FROM, brevoStatus: result.status, brevoResponse: result.body },
    { status: result.ok ? 200 : 502 }
  )
}
