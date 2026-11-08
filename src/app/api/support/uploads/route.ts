import { NextResponse, type NextRequest } from 'next/server'
import { presignSupportUploads } from '@/lib/support/handler'
import { clientIp } from '@/lib/support/rate-limit'
import { currentSender, uploadDeps } from '@/lib/support/server'

export const runtime = 'nodejs'

/**
 * Presigned PUTs for up to 3 support screenshots (png/jpg/webp, ≤ 5 МБ),
 * into the private bucket: support/<user_id>/… from the dashboard,
 * support/public/… from the contact page. The browser uploads directly.
 */
export async function POST(request: NextRequest) {
  const body: unknown = await request.json().catch(() => null)
  try {
    const result = await presignSupportUploads(body, await currentSender(), clientIp(request.headers), uploadDeps())
    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    console.error('support upload presign failed:', error)
    return NextResponse.json({ error: 'storage_unavailable' }, { status: 503 })
  }
}
