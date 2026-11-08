import type { SupabaseClient } from '@supabase/supabase-js'
import { defaultLocale, isLocale, type Locale } from '@/lib/i18n/config'

/**
 * «Клієнт може завантажувати фото» — galleries.downloads_enabled (0070).
 *
 * Read in its own query, never added to an existing select: until 0070 is
 * applied the column does not exist, and a select naming it would fail the
 * whole gallery read. A missing column means «allowed» — exactly how every
 * gallery behaved before the switch existed. Any other read failure means
 * «off» for that request: it is a privacy switch, so it fails closed.
 */
export interface DownloadsSetting {
  enabled: boolean
  /** false — migration 0070 not applied yet (the column is missing). */
  available: boolean
}

type PgError = { code?: string; message?: string } | null

/** PostgREST / Postgres answers for «no such column» or «not granted yet». */
export function isMissingDownloadsColumn(error: PgError): boolean {
  if (!error) return false
  if (error.code === '42703' || error.code === 'PGRST204') return true
  // Column added but grant (0070) not applied: «permission denied for … downloads_enabled».
  return /downloads_enabled/.test(error.message ?? '')
}

export async function readDownloadsSetting(
  client: Pick<SupabaseClient, 'from'>,
  galleryId: string
): Promise<DownloadsSetting> {
  try {
    const { data, error } = await client
      .from('galleries')
      .select('downloads_enabled')
      .eq('id', galleryId)
      .maybeSingle<{ downloads_enabled?: boolean | null }>()
    if (error) {
      if (isMissingDownloadsColumn(error)) return { enabled: true, available: false }
      // Any other failure: we cannot tell what the photographer chose, and
      // this is a privacy switch — close downloads for this request (the
      // gallery itself still shows; the next request reads again).
      console.error('readDownloadsSetting failed', galleryId, error.message)
      return { enabled: false, available: true }
    }
    // A row without the field (older select shape) counts as «allowed».
    return { enabled: data?.downloads_enabled !== false, available: true }
  } catch (cause) {
    console.error('readDownloadsSetting threw', galleryId, cause)
    return { enabled: false, available: true }
  }
}

/** The JSON/text body of a «downloads are off» 403. */
export const DOWNLOADS_DISABLED = 'downloads_disabled'

/**
 * The visitor's language for a human 403 text: ?lang=, then the gallery page
 * it came from (/pl/g/…), then Accept-Language, else Ukrainian.
 */
export function requestLocale(request: { url: string; headers: Headers }): Locale {
  const fromQuery = new URL(request.url).searchParams.get('lang')
  if (fromQuery && isLocale(fromQuery)) return fromQuery
  const referer = request.headers.get('referer')
  if (referer) {
    try {
      const segment = new URL(referer).pathname.split('/')[1] ?? ''
      if (isLocale(segment)) return segment
    } catch {
      /* not a URL */
    }
  }
  for (const part of (request.headers.get('accept-language') ?? '').split(',')) {
    const code = part.trim().slice(0, 2).toLowerCase()
    if (isLocale(code)) return code
  }
  return defaultLocale
}

/**
 * 403 «завантаження вимкнено» in the visitor's language. `json` for the
 * archive list (read by the gallery's script), plain text for a single photo
 * (opened as a link, so the browser shows the sentence itself).
 */
export async function downloadsDisabledResponse(
  request: { url: string; headers: Headers },
  format: 'json' | 'text'
): Promise<Response> {
  const { getDictionary } = await import('@/lib/i18n')
  const message = (await getDictionary(requestLocale(request))).publicGallery.downloadsDisabled
  if (format === 'json') {
    return Response.json({ error: DOWNLOADS_DISABLED, message }, { status: 403 })
  }
  return new Response(message, {
    status: 403,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
