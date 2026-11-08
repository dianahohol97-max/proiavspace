import { NextResponse, type NextRequest } from 'next/server'
import { submitSupportRequest } from '@/lib/support/handler'
import { clientIp } from '@/lib/support/rate-limit'
import { currentSender, submitDeps, supportCopy, supportLocale } from '@/lib/support/server'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * One support request: from the dashboard «Допомога» panel (signed in —
 * the account is the sender) or the public /contact page (email field,
 * honeypot, 5 per IP per hour). Logic: src/lib/support/handler.ts.
 */
export async function POST(request: NextRequest) {
  const body: unknown = await request.json().catch(() => null)
  const locale = supportLocale((body as { locale?: unknown } | null)?.locale)
  const result = await submitSupportRequest(
    body,
    await currentSender(),
    {
      ip: clientIp(request.headers),
      locale,
      copy: await supportCopy(locale),
      userAgentFromServer: request.headers.get('user-agent') ?? undefined,
    },
    submitDeps()
  )
  return NextResponse.json(result.body, { status: result.status })
}
